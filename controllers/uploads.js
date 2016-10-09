"use strict";

var express = require('express');
var router = express.Router();

var readChunk = require('read-chunk'),
		fileType = require('file-type'),
		Promise = require('bluebird'),
		fs = Promise.promisifyAll(require('fs-extra')),
		path = require('path'),
		_ = require('lodash');

var validPathRe = new RegExp("^([a-z0-9\\/-]+\\.[a-z0-9]+)$");
var validPathThumbsRe = new RegExp("^([0-9]+\\.png)$");

// ==========================================
// SERVE UPLOADS FILES
// ==========================================

router.get('/t/*', (req, res, next) => {

	let fileName = req.params[0];
	if(!validPathThumbsRe.test(fileName)) {
		return res.sendStatus(404).end();
	}

	//todo: Authentication-based access

	res.sendFile(fileName, {
		root: lcdata.getThumbsPath(),
		dotfiles: 'deny'
	}, (err) => {
		if (err) {
			res.status(err.status).end();
		}
	});

});

router.post('/img', lcdata.uploadImgHandler, (req, res, next) => {

	let destFolder = _.chain(req.body.folder).trim().toLower().value();
	let destFolderPath = lcdata.validateUploadsFolder(destFolder);

	Promise.map(req.files, (f) => {

		let destFilename = '';
		let destFilePath = '';

		return lcdata.validateUploadsFilename(f.originalname, destFolder).then((fname) => {
			
			destFilename = fname;
			destFilePath = path.resolve(destFolderPath, destFilename);

			return readChunk(f.path, 0, 262);

		}).then((buf) => {

			//-> Check MIME type by magic number

			let mimeInfo = fileType(buf);
			if(!_.includes(['image/png', 'image/jpeg', 'image/gif', 'image/webp'], mimeInfo.mime)) {
				return Promise.reject(new Error('Invalid file type.'));
			}
			return true;

		}).then(() => {

			//-> Move file to final destination

			return fs.moveAsync(f.path, destFilePath, { clobber: false });

		}).then(() => {
			return {
				ok: true,
				filename: destFilename,
				filesize: f.size
			};
		}).reflect();

	}, {concurrency: 3}).then((results) => {
		let uplResults = _.map(results, (r) => {
			if(r.isFulfilled()) {
				return r.value();
			} else {
				return {
					ok: false,
					msg: r.reason().message
				}
			}
		});
		res.json({ ok: true, results: uplResults });
	}).catch((err) => {
		res.json({ ok: false, msg: err.message });
	});

});

router.get('/*', (req, res, next) => {

	let fileName = req.params[0];
	if(!validPathRe.test(fileName)) {
		return res.sendStatus(404).end();
	}

	//todo: Authentication-based access

	res.sendFile(fileName, {
		root: git.getRepoPath() + '/uploads/',
		dotfiles: 'deny'
	}, (err) => {
		if (err) {
			res.status(err.status).end();
		}
	});

});

module.exports = router;