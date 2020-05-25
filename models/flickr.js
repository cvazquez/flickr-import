exports.flickrModel = class flickrModel {
	constructor(ds) {
		this.ds = ds;
	}

	getAlbumInfo(albumbIds) {
		return new Promise((resolve, reject) => {
		this.ds.query(`	SELECT id, title, description
						FROM flickrsets
						WHERE id IN (${albumbIds})`,
			(err, rows) => {
				if(err) console.log(err);

				resolve(rows);
			}
		)})
	}

	getAlbumPhotos(albumId) {
		return new Promise((resolve, reject) => {
			this.ds.query(`	SELECT id, title, description
							FROM flickrsetphotos
							WHERE flickrSetId = ?`, [albumId],
				(err, rows) => {
					if(err) reject(err);

					resolve(rows);
				})
		}).catch(err => {
			return({failed: true,
					reason: err});
		})
	}

	getCollections() {
		return new Promise((resolve, reject) => {
			this.ds.query(`
				SELECT id
				FROM flickrcollections;`,
			(err, rows) => {
				if(err) console.log(err);

				resolve(rows);
			})
		})
	}

	getCredentials() {
		return new Promise((resolve, reject) => {
			this.ds.query(`	SELECT name, value
							FROM adminsettings
							WHERE	name IN ('flickrAPIKey', 'flikrAPISecret', 'flickrUserId')
									AND deletedAt IS NULL`,
			(err, rows) => {
				if(err) console.log(err);

				resolve(rows);
			})
		})
	}

	saveAlbum(id, flickrCollectionId, title, description) {
		return new Promise((resolve, reject) => {
			this.ds.query(`	INSERT INTO flickrsets
							SET id 					= ?,
								flickrCollectionId	= ?,
								title				= ?,
								description			= ?,
								createdAt			= now()`,
							[id, flickrCollectionId, title, description],
							(err, rows) => {
								if(err) reject(err);

								resolve(rows);
							})
		}).catch((err) => {
			let reason = err;

			if(err.errno === 1062) {
				reason = "Photo Albums already exist in DB";
			}

			return({failed: true,
					reason: reason});
		});
	}

	saveOAuth(userNSid, fullName, userName, oauthToken, oauthTokenSecret) {
		return new Promise((resolve, reject) => {
			this.ds.query(`	INSERT INTO flickroauth (userNSid, fullName, userName, oauthToken, oauthTokenSecret)
							VALUES (?, ?, ?, ?, ?)`, [userNSid, fullName, userName, oauthToken, oauthTokenSecret],
					(err, rows) => {
						if(err) reject(err);

						resolve(rows);
					})
		}).catch(err => {
			return({failed: true,
					reason: err});
		})
	}

	savePhotos(values) {
		return new Promise((resolve, reject) => {
			this.ds.query(`	INSERT INTO flickrsetphotos
							(	id, flickrSetId, orderId,
								title, description,
								smallURL, smallWidth, smallHeight,
								squareURL, squareWidth, squareHeight,
								mediumURL, mediumWidth, mediumHeight,
								largeURL, largeWidth, largeHeight,
								takenAt)
							VALUES ?;`,
							[values],
					(err, rows) => {
						if(err) reject(err);

						resolve(rows)
					})
		}).catch((err) => {
			let reason = err;

			if(err.errno === 1062) {
				reason = "Photos already exist in DB";
			} else {
			//	console.log(err);
			}

			return({failed: true,
					reason: reason,
					errno: err.errno});
		});
	}

	savePhotoURLS() {
		return new Promise((resolve, reject) => {
			this.ds.query(`	INSERT IGNORE INTO flickrsetphotourls (flickrSetPhotoId, name, isActive, createdAt)
							SELECT id, CreateTitleURL(title), 1, now()
							FROM flickrsetphotos
							WHERE deletedAt IS NULL
							ORDER BY id;`,
				(err, rows) => {
					if(err) reject(err);

					resolve(rows);
				})
		}).catch((err) => {
			return({failed: true,
					reason: err});
		});
	}

	updateAlbum(id,
				title,
				description) {

		return new Promise((resolve, reject) => {
			this.ds.query(`	UPDATE flickrsets
							SET title = ?,
								description	= ?,
								updatedAt = CASE WHEN (? <> title OR ? <> description) THEN now() ELSE updatedAt END
							WHERE id = ?;`,
							[title, description, title, description, id],
				(err, rows) => {
					if(err) reject(err);

					resolve(rows);
				})
			}).catch((err) => {
				console.log(`updateAlbum(${albumId} error : )`, err);
			});
	}

	updatePhoto(id,
				title,
				description,
				squareURL,
				squareWidth,
				squareHeight,
				smallURL,
				smallWidth,
				smallHeight,
				mediumURL,
				mediumWidth,
				mediumHeight,
				largeURL,
				largeWidth,
				largeHeight) {
		return new Promise((resolve, reject) => {
			this.ds.query(`	UPDATE flickrsetphotos
							SET	title		= ?,
								description	= ?,
								squareURL	= ?,
								squareWidth	= ?,
								squareHeight= ?,
								smallURL	= ?,
								smallWidth	= ?,
								smallHeight	= ?,
								mediumURL	= ?,
								mediumWidth	= ?,
								mediumHeight= ?,
								largeURL	= ?,
								largeWidth	= ?,
								largeHeight	= ?,
								updatedAt	= now()
							WHERE id = ?`, [title,
											description,
											squareURL,
											squareWidth,
											squareHeight,
											smallURL,
											smallWidth,
											smallHeight,
											mediumURL,
											mediumWidth,
											mediumHeight,
											largeURL,
											largeWidth,
											largeHeight,
											id],
				(err, rows) => {
					if(err) reject(err);

					resolve(rows);
				})
		}).catch(err => {
			console.log(`updatePhoto(${photoId}, ${title}, ${description})`, err);
		})
	}
}