const model	= require("../models/model");

exports.flickrModel = class flickrModel extends model {
	constructor(ds) {
		super(ds);
		this.ds = ds;
	}

	getAlbumInfo(albumbIds) {
		return this.getQueryResults(
			"getAlbumInfo",
			`	SELECT id, title, description
				FROM flickrsets
				WHERE	id IN (${albumbIds})
						AND deletedAt IS NULL`
		)
	}

	getAlbumPhotos(albumId) {
		return this.getQueryResults(
			"getAlbumPhotos",
			`	SELECT id, title, description
				FROM flickrsetphotos
				WHERE	flickrSetId = ?
						AND deletedAt IS NULL`, [albumId]
		)
	}

	getCollections() {
		return this.getQueryResults(
			"getCollections",
			`	SELECT id
				FROM	flickrcollections
				WHERE	deletedAt IS NULL;`
		)
	}

	getCredentials() {
		return this.getQueryResults(
			"getCredentials",
			`	SELECT name, value
				FROM adminsettings
				WHERE	name IN ('flickrAPIKey', 'flikrAPISecret', 'flickrUserId')
						AND deletedAt IS NULL`
		)
	}

	getOAuthAccessToken(userName) {
		return this.getQueryResults(
			"getOAuthAccessToken",
			`	SELECT userNSid, fullName, oauthToken, oauthTokenSecret
				FROM flickroauth
				WHERE 	userName = ?
						AND deletedAt IS NULL
				ORDER BY id desc
				LIMIT 1`, [userName]
		)
	}

	saveAlbum(id, flickrCollectionId, title, description) {
		return this.getQueryResults(
			"saveAlbum",
			`	INSERT INTO flickrsets
				SET id 					= ?,
					flickrCollectionId	= ?,
					title				= ?,
					description			= ?,
					createdAt			= now()`,
				[id, flickrCollectionId, title, description]
		)
	}

	saveOAuth(userNSid, fullName, userName, oauthToken, oauthTokenSecret) {
		return this.getQueryResults(
			"saveOAuth",
			`	INSERT INTO flickroauth (userNSid, fullName, userName, oauthToken, oauthTokenSecret)
				VALUES (?, ?, ?, ?, ?)`, [userNSid, fullName, userName, oauthToken, oauthTokenSecret]
		)
	}

	savePhotos(values) {
		return this.getQueryResults(
			"savePhotos",
			`	INSERT IGNORE INTO flickrsetphotos
				(	id, flickrSetId, orderId,
					title, description,
					smallURL, smallWidth, smallHeight,
					squareURL, squareWidth, squareHeight,
					mediumURL, mediumWidth, mediumHeight,
					largeURL, largeWidth, largeHeight,
					takenAt)
				VALUES ?;`,
				[values]
		)
	}

	savePhotoURLS() {
		return this.getQueryResults(
			"savePhotoURLS",
			`	INSERT IGNORE INTO flickrsetphotourls (flickrSetPhotoId, name, isActive, createdAt)
				SELECT id, CreateTitleURL(title), 1, now()
				FROM flickrsetphotos
				WHERE deletedAt IS NULL
				ORDER BY id;`
		)
	}

	updateAlbum(id,
				title,
				description) {
		return this.getQueryResults(
			"updateAlbum",
			`	UPDATE flickrsets
				SET title = ?,
					description	= ?,
					updatedAt = CASE WHEN (? <> title OR ? <> description) THEN now() ELSE updatedAt END
				WHERE id = ?;`,
				[title, description, title, description, id]
		)
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
		return this.getQueryResults(
			"updatePhoto",
			`	UPDATE flickrsetphotos
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
											id]
		)
	}
}