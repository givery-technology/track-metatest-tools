#!/usr/bin/env node

const converter = require('../lib/converter');
const docopt = require('docopt');
const { spawnSync } = require('child_process');
const fs = require('fs-extra');
const YAML = require('yaml');

const USAGE = `
Usage:
  metatest copy <src> to <dest>
  metatest copy <src> to <dest> and <exec> then (junit|xunit) <xml> should (pass|fail) as <testcase_name> [count from <offset>]
  metatest do <exec> then (junit|xunit) <xml> should (pass|fail) as <testcase_name> [count from <offset>]
  metatest do <exec> then expand (junit|xunit) <xml> [with mappings <mappings>] [count from <offset>]
`;

const args = docopt.docopt(USAGE, { argv: process.argv.slice(2) });

if (args.copy) {
	copy(args['<src>'], args['<dest>']);
}

let ok;
if (args.should) {
	ok = squashExec(args['<testcase_name>'], args['<exec>'], args['<xml>'], args.pass, converterFactory(args), Number(args['<offset>']));
} else if (args.expand) {
	ok = expandExec(args['<exec>'], args['<xml>'], converterFactory(args), args['<mappings>'], Number(args['<offset>']));
}

if (!ok) {
	process.exit(-1);
}

//-------------------------------------

/**
 * @callback toTestResultConverter
 * @param {string} source
 * @returns {Array.<TestResult>}
 */

/**
 * @param {Object.<string, Object>} args
 * @returns {?toTestResultConverter}
 */
function converterFactory(args) {
	if (args.junit) {
		return converter.fromJUnit;
	} else if (args.xunit) {
		return converter.fromXUnit;
	}
}

/**
 * @param {string?} src    Source path to replacement
 * @param {string?} dest   Destination path to be replaced
 */
function copy(src, dest) {
	fs.copySync(src, dest);
}

/**
 *
 * @param {string}  name     Testcase name
 * @param {string}  exec     Execution command to test
 * @param {string}  xmlPath  Path to report XML file
 * @param {boolean} pass     Whether all tests should pass
 * @param {number}  count_offset  Reports testcase number start with the given offset
 * @param {toTestResultConverter} conv
 */
function squashExec(name, exec, xmlPath, pass, conv, count_offset) {
	const cmd = exec.split(/\s+/);
	const p = spawnSync(cmd[0], cmd.slice(1), {encoding: 'utf-8'});
	console.log(p.stdout);
	const junitXml = fs.readFileSync(xmlPath, 'utf-8');
	const testResults = conv(junitXml);

	const finalResults = [squash(name, testResults, pass)];
	console.log(converter.toTap(finalResults, count_offset));
	return allGreen(finalResults);
}

function expandExec(exec, xmlPath, conv, mappingsPath, count_offset) {
	const cmd = exec.split(/\s+/);
	const p = spawnSync(cmd[0], cmd.slice(1), {encoding: 'utf-8'});
	console.log(p.stdout);
	const junitXml = fs.readFileSync(xmlPath, 'utf-8');
	const testResults = conv(junitXml);
	const mappings = loadMappings(mappingsPath);

	console.log(converter.toTap(testResults, mappings, count_offset));
	return allGreen(testResults);
}

function loadMappings(path) {
	if (!path) {
		return null;
	}
	return YAML.parse(fs.readFileSync(path, 'utf-8'));
}

function squash(name, testResults, pass) {
	const failedTests = testResults.filter(tr => !tr.ok);

	return {
		name: name,
		ok: !!(failedTests.length > 0) !== pass,
		message: pass ? failedTests.map(tr => `* ${tr.name}`).join('\n') : undefined
	};
}

function allGreen(testResults) {
	return testResults.every(tr => tr.ok);
}
