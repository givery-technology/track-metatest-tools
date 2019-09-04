const fs = require('fs-extra');
const yaml = require('yaml');

function load(path) {
	const file = fs.readFileSync(path, 'utf-8');
	return yaml.parse(file);
}
module.exports.load = load;
