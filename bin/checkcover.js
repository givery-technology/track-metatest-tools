#!/usr/bin/env node

const converter = require('../lib/converter');
const config = require('../lib/config');
const docopt = require('docopt');
const { spawnSync } = require('child_process');
const fs = require('fs-extra');

const USAGE = `
Usage:
  checkcover (jacoco|cobertura) <path> with config <config> [count from <offset>]
`;

const args = docopt.docopt(USAGE, { argv: process.argv.slice(2) });

if (args.jacoco) {
	checkJacocoCoverage(args['<path>'], args['<config>'], Number(args['<offset>']));
} else if (args.cobertura) {
	checkCoberturaCoverage(args['<path>'], args['<config>'], Number(args['<offset>']));
}

function checkJacocoCoverage(path, conf, offset) {
	const c = config.load(conf);
	let result;
	try {
		const xml = fs.readFileSync(path, 'utf-8');
		result = converter.fromJacoco(xml, c);
	} catch (_) {
		result = converter.fromErrornousCoverage(c);
	}
	console.log(converter.toTap(result, offset));
}

function checkCoberturaCoverage(path, conf, offset) {
	const c = config.load(conf);
	let result;
	try {
		const xml = fs.readFileSync(path, 'utf-8');
		result = converter.fromCobertura(xml, c);
	} catch (_) {
		result = converter.fromErrornousCoverage(c);
	}
	console.log(converter.toTap(result, offset));
}
