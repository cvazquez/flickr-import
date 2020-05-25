/*
	Flick OAuth Login
	Author: Carlos Vazquez (cvazquez1976@gmail.com)
	Personal Website: http://www.carlosvazquez.org
	Repo: https://github.com/cvazquez/flickr-import
	Date: 5/25/2020

	Flickr OAuth Guide
	https://www.flickr.com/services/api/auth.oauth.html

	Some Fun
	https://www.youtube.com/watch?v=H8Q83DPZy6E
*/

const	crypto			= require("crypto"),
		flikrDS			= require('../connectors/mysql').connection,
		flickrClass		= require("../models/flickr").flickrModel,
		flickrModel		= new flickrClass(flikrDS),
		apiClass		= require('./api').api,
		rl				= require('readline').createInterface({
							input: process.stdin,
							output: process.stdout
						});

( async () =>{
	let api						= await new apiClass(flickrModel),
		apiCreds				= await api.getAPICreds(),
		requestTokenURL			= "https://www.flickr.com/services/oauth/request_token",
		requestTokenQueryString	= getRequestTokenQueryString(apiCreds, requestTokenURL, "oob"),
		requestTokenFullURL 	= requestTokenURL + "?" + requestTokenQueryString,
		requestTokenResponse,
		responseKeyValues,
		requestAuthorizeURL		= "https://www.flickr.com/services/oauth/authorize",
		requestAccessTokenURL 	= "https://www.flickr.com/services/oauth/access_token";

	requestTokenResponse = await requestToken(requestTokenFullURL);
	responseKeyValues = getResponseKeyValues(requestTokenResponse);

	if(responseKeyValues.oauth_callback_confirmed) {

		console.log("\n\nIMPORTANT: Go to the following URL, Click 'OK, I'll Authorize it' and copy the code given:");
		console.log(requestAuthorizeURL + "?oauth_token=" + responseKeyValues.oauth_token)

		rl.question("\nEnter Authorization Code: ", async oauth_verifier => {
			const	requestAccessTokenQueryString	= getRequestTokenQueryString(
											apiCreds,
											requestAccessTokenURL,
											null,
											responseKeyValues.oauth_token,
											oauth_verifier.trim(),
											responseKeyValues.oauth_token_secret),
					requestAccessTokenResponse	= await requestToken(
														requestAccessTokenURL +
														"?" +
														requestAccessTokenQueryString),
					responseAccessTokenKeyValues= getResponseKeyValues(requestAccessTokenResponse),
					oAuthSaveResponse 			= await flickrModel.saveOAuth(
													decodeURIComponent(responseAccessTokenKeyValues.user_nsid),
													decodeURIComponent(responseAccessTokenKeyValues.fullname),
													decodeURIComponent(responseAccessTokenKeyValues.username),
													decodeURIComponent(responseAccessTokenKeyValues.oauth_token),
													decodeURIComponent(responseAccessTokenKeyValues.oauth_token_secret));

			console.log(oAuthSaveResponse)

			rl.close();
		});
	} else {
		console.error("********* Failed response Requesting Tokens *********")
	}
})();

function getRequestTokenQueryString(apiCreds, requestURL, oauth_callback, oauth_token, oauth_verifier, oauth_token_secret) {
	const	requestTokens	= {
				oauth_callback			: oauth_callback || null,
				oauth_consumer_key		: apiCreds.key,
				oauth_nonce				: crypto.randomBytes(5).toString('hex'),
				oauth_signature_method	: "HMAC-SHA1",
				oauth_timestamp			: Math.floor(new Date().getTime()/1000.0), // convert milliseconds to seconds
				oauth_token				: oauth_token || null,
				oauth_verifier			: oauth_verifier || null,
				oauth_version			: "1.0"
			};

	let	baseString = "GET&" + encodeURIComponent(requestURL) + "&",
		oauthSignature,
		requestQueryString = "";

	for(let token in requestTokens) {
		if(requestTokens[token] !== null) {
			baseString += token + encodeURIComponent("=" + requestTokens[token] + (token !== "oauth_version" ? "&" : ""));
		}
	}

	oauthSignature = crypto.createHmac("sha1", apiCreds.secret + "&" + (oauth_token_secret && oauth_token_secret !== null ? oauth_token_secret : "")).update(baseString).digest().toString('base64');

	for(let token in requestTokens) {
		if(requestTokens[token] !== null) {
			requestQueryString += token + "=" + requestTokens[token] + "&";
		}
	}

	return (requestQueryString + "oauth_signature=" + encodeURIComponent(oauthSignature));
}


async function requestToken(url) {
	const https			= require("https");

	return new Promise((resolve, reject) => {
		https.get(url,
			res => {
				var body = "";

				res.on("data", data => {
					body += data;
				});

				res.on("end", () => {
					if([200].indexOf(res.statusCode) > -1) {
						try {
							resolve(body);
						} catch(e) {
							process.stdout.write(`Error parsing requestToken body`);
							console.log(e);
						}
					} else {
						console.log(`********* Bad response code in requestToken(${url}) ***********`);
						console.log(res.statusCode)
					}
				});
			}).on('error', (e) => {
				process.stdout.write(`\nrequestToken(${url}) API response error\n`);
				console.error(e);
			});
	});
}

function getResponseKeyValues(response) {
	const responseKeyValues = response.split("&");
	let responseTokens = {};

	for(let responseKeyValue in responseKeyValues) {
		const	responseKey = responseKeyValues[responseKeyValue].split("=")[0],
				responseValue = responseKeyValues[responseKeyValue].split("=")[1];

		responseTokens[responseKey] = responseValue;
	}

	return responseTokens;
}