#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const program = require('commander');
const package = require('./package.json');
const tinify = require("tinify");

program
	.name('web-tools')
	.description('CLI to some web utilities')
	.version(package.version);

program
	.command('image')
	.description('compress image using tinypng')
	.argument('<string>', 'source file or folder')
	.option('-t, --types <png/jpg/jpeg/webp/gif>', 'image types', 'png/jpg/jpeg/webp/gif')
	// .option('-r, --recursive <boolean>', 'recursively compress images', 'true')
	.option('-k, --key <string>', 'tinypng key')
	.requiredOption('-c, --compress', 'compress file or folder')
	.requiredOption('-o, --output <output>', 'destination file or folder')
	.action(compressImageAction)

program.parse(process.argv);

async function isDirectory(p) {
	const stat = await fs.promises.stat(p);
	return stat.isDirectory();
}

async function loadAllFiles(source, options, result) {
	const files = await fs.promises.readdir(source);
	for(const file of files) {
		const fullPath = path.join(source, file);
		if(await isDirectory(fullPath)) {
			await loadAllFiles(fullPath, options, result);
		} else {
			if(options.typeRegex.test(file)) {
				result.push({
					path: source,
					name: file,
					fullPath
				});
			}
		}
	}
}

async function fileSize(filePath) {
	const stat = await fs.promises.stat(filePath);
	return stat.size;
}

async function compressImageDirectory(source, options) {

	const files = [];
	await loadAllFiles(source, options, files);
	if(files.length === 0) {
		console.error('no matched files');
		return false;
	}
	let count = 0;
	for(const file of files) {
		++ count;
		const relativePath = path.relative(source, file.path);
		let output = path.join(options.output, relativePath);
		await fs.promises.mkdir(output, {recursive: true});
		output = path.join(output, file.name);

		console.log(`[${count}/${files.length}]`, file.fullPath.replace(source, ''), ' => ', output)
		await tinify.fromFile(file.fullPath).toFile(output);

		const sourceSize = await fileSize(file.fullPath);
		const outputSize = await fileSize(output);
		console.log('\t', sourceSize, ' => ', outputSize, (((sourceSize - outputSize) * 100.0) / sourceSize).toFixed(1) + '%');
	}
	return true;
}

async function compressImage(source, options) {
	if(!options.typeRegex.test(source)) {
		console.error(`${source} doesn't match image types`);
		return false;
	}
	await tinify.fromFile(source).toFile(options.output);
	return true;
}

async function compressImageAction(source, options) {
	console.dir(options);

	if(!options.key) {
		console.error('no tinypng key provided');
		return;
	}

	tinify.key = options.key;
	let isDir = false;
	try {
		isDir = await isDirectory(source);
	} catch (e) {
		console.error('file/folder not exists')
		return;
	}
	options.typeRegex = '\.(' + options.types.replace(/\//g, '|') + '$)';
	options.typeRegex = new RegExp(options.typeRegex);

	if(isDir) {
		await compressImageDirectory(source, options);
	} else {
		await compressImage(source, options);
	}

	console.log('done');
}
