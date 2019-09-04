const htmlparser2 = require('htmlparser2');
const { xml2js } = require('xml-js');

/**
 * @param {string} xml            jUnit report file (XML) contents
 * @returns {Array.<TestResult>}  List of test case result
 */
function fromJUnit(xml) {
	let list = [];
	let stack = [];
	let s = '';
	const parser = new htmlparser2.Parser({
		onopentag: (name, attributes) => {
			stack.push([name, attributes]);
		},
		onclosetag: name => {
			let n = stack.pop();
			if (name !== 'testcase') {
				return;
			}
			list.push({
				ok: s.length === 0,
				name: [
					(/[^.]+$/.exec(n[1].classname) || ['unknown'])[0],
					n[1].name
				].join(' '),
				message: s
			});
			s = '';
		},
		oncomment: text => {
			if (text.startsWith('[CDATA[')) {
				s += text.substr(7, text.length - 9);
			}
		},
		ontext: text => {
			if (!!stack.find(e => e[0] === 'testcase') && text.trim() !== '') {
				s+= text.trim();
			}
		},
	}, {decodeEntities: true});
	parser.write(xml);
	parser.end();
	return list;
}
module.exports.fromJUnit = fromJUnit;

/**
 * @param {string} xml            xUnit report file (XML) contents
 * @returns {Array.<TestResult>}  List of test case result
 */
function fromXUnit(xml) {
	let list = [];
	let stack = [];
	let s = '';
	const parser = new htmlparser2.Parser({
		onopentag: (name, attributes) => {
			stack.push([name, attributes]);
		},
		onclosetag: name => {
			let n = stack.pop();
			if (name !== 'test') {
				return;
			}
			list.push({
				ok: s.length === 0,
				name: n[1].name,
				message: s
			});
			s = '';
		},
		ontext: text => {
			let n = stack[stack.length - 1];
			if (!!n && (n[0] === 'message' || n[0] === 'stack-trace')) {
				s += text;
				s += '\n';
			}
		},
	}, {decodeEntities: true});
	parser.write(xml);
	parser.end();
	return list;
}
module.exports.fromXUnit = fromXUnit;

function fromErrornousCoverage(config) {
	let result = [];
	for (let target of config) {
		result.push({
			name: coverageTargetToTestcaseName(target),
			ok: false,
		})
	}
	return result;
}
module.exports.fromErrornousCoverage = fromErrornousCoverage;

/**
 * @param {string} xml                     jacoco report file (XML) contents
 * @param {Array.<CoverageTarget>} config  Coverage requirement configuration
 * @returns {Array.<TestResult>}           List of test case result
 */
function fromJacoco(xml, config) {
	const report = xml2js(xml, {compact: true});
	let result = [];
	for (let target of config) {
		result.push({
			name: coverageTargetToTestcaseName(target),
			ok: validateJacocoReport(extractCounters(report, target.target), target.conditions)
		})
	}
	return result;
}
module.exports.fromJacoco = fromJacoco;

function coverageTargetToTestcaseName(target) {
	let targetName;
	switch (target.target.type) {
		case 'method':
			targetName = `メソッド${target.target.name}`;
			break;
		case 'class':
			targetName = `クラス${target.target.name}`;
			break;
		default:
			targetName = `不明`;
			break;
	}
	let conds = [];
	if (!!target.conditions.line) {
		conds.push(`行網羅が${Number(target.conditions.line) * 100}%以上`);
	}
	if (!!target.conditions.instruction) {
		conds.push(`命令網羅(C0)が${Number(target.conditions.instruction) * 100}%以上`);
	}
	if (!!target.conditions.branch) {
		conds.push(`分岐網羅(C1)が${Number(target.conditions.branch) * 100}%以上`);
	}
	if (!!target.conditions.complexity) {
		conds.push(`循環複雑度の組合せ網羅が ${Number(target.conditions.complexity) * 100}% 以上`);
	}
	return `[網羅率] ${targetName}の${conds.join('か')}`;
}

function validateJacocoReport(counters, conditions) {
	for (let counter of counters) {
		let type = counter._attributes.type.toLowerCase();
		let coverageThreshold = Number(conditions[type]);
		if (!coverageThreshold) {
			continue;
		}
		const missed = Number(counter._attributes.missed);
		const covered = Number(counter._attributes.covered);
		const coverage = covered / (missed + covered);
		if (coverage >= coverageThreshold) {
			return true;
		}
	}
	return false;
}

function extractCounters(report, target) {
	switch (target.type) {
		case 'method': {
			const tokens = target.name.split('.');
			const klassName = tokens.slice(0, tokens.length - 1).join('/');
			const methodName = tokens[tokens.length - 1];
			for (let package of arr(report.report.package)) {
				for (let klass of arr(package.class)) {
					if (klass._attributes.name !== klassName) {
						continue;
					}
					for (let method of arr(klass.method)) {
						if (method._attributes.name != methodName) {
							continue;
						}
						if (!!target.desc && target.desc !== method._attributes.desc) {
							continue;
						}
						return arr(method.counter);
					}
				}
			}
			return [];
		}
		case 'class': {
			const tokens = target.name.split();
			const klassName = tokens.subarray(0, tokens.length - 1).join('/');
			for (let package of arr(report.report.package)) {
				for (let klass of arr(package.class)) {
					if (klass._attributes.name !== klassName) {
						continue;
					}
					return arr(klass.counter);
				}
			}
			return [];
		}
		default:
			return [];
	}
}

function arr(x) {
	if (x === null || x === undefined) {
		return [];
	} else if (x instanceof Array) {
		return x;
	} else {
		return [x];
	}
}

function flatMap(xs, fn) {
	let result = [];
	for (let elem of xs) {
		for (let elem2 of arr(fn(elem))) {
			result.push(elem2);
		}
	}
	return result;
}

/**
 * @param {string} xml                     jacoco report file (XML) contents
 * @param {Array.<CoverageTarget>} config  Coverage requirement configuration
 * @returns {Array.<TestResult>}           List of test case result
 */
function fromCobertura(xml, config) {
	const report = xml2js(xml, {compact: true});
	const coverage = {
		class: {},
		method: {}
	};
	const methodCoverage = {};
	flatMap(arr(report.coverage.packages.package), pkg => arr(pkg.classes.class))
		.forEach(cls => {
			const attributes = cls._attributes;
			const className = attributes.name;
			coverage.class[className] = {
				line: attributes['line-rate'],
				branch: attributes['branch-rate']
			};
			arr(cls.methods.method)
				.forEach(method => {
					const attributes = method._attributes;
					const methodName = className + '.' + attributes.name;
					coverage.method[methodName] = {
						line: attributes['line-rate'],
						branch: attributes['branch-rate']
					};
				})
		});

	let result = [];
	for (let target of config) {
		result.push({
			name: coverageTargetToTestcaseName(target),
			ok: validateCoverage(coverage, target)
		});
	}
	return result;
}
module.exports.fromCobertura = fromCobertura;

function validateCoverage(coverage, target) {
	const c = ((coverage[target.target.type] || {})[target.target.name] || {});
	if (!!target.conditions.branch && c.branch >= target.conditions.branch) {
		return true;
	}
	if (!!target.conditions.line && c.line >= target.conditions.line) {
		return true;
	}
	return false;
}

/**
 *
 * @param {Array.<TestResult>}  testResults List of test case result
 * @param {=Object.<string, string>} opt_mappings testcase name mappings (optional)
 * @param {=number}             opt_offset  testcase start number (optional)
 * @returns string              TAP formatted text
 */
function toTap(testResults, opt_mappings, opt_offset) {
	let mappings = (typeof opt_mappings) == "object" && !!opt_mappings /* not null */ ? opt_mappings : {};
	let i = ((typeof opt_mappings) == "number" ? opt_mappings :
		((typeof opt_offset) == "number" ? opt_offset : 1)) || 1; // 0, NaN, undefined, ... -> 1

	let s = '';
//	s += `1..${testResults.length}\n`;
	for (let tr of testResults) {
		s+= `${tr.ok ? '' : 'not '}ok ${i++} ${mappings[tr.name] || tr.name}\n`;
		if (!!tr.message) {
			for (let line of tr.message.split('\n')) {
				s += `    ${line}\n`;
			}
		}
	}
	return s;
}
module.exports.toTap = toTap;

