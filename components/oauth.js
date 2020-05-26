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

const	crypto	= require("crypto"),
		https	= require("https");

function getRequestTokenQueryString(method="GET", apiCreds, requestURL, oauth_callback, oauth_token, oauth_verifier, oauth_token_secret, queryKeyValues) {
	let	requestTokens	= {
				oauth_callback			: oauth_callback || null,
				oauth_consumer_key		: apiCreds.key,
				oauth_nonce				: crypto.randomBytes(5).toString('hex'),
				oauth_signature_method	: "HMAC-SHA1",
				oauth_timestamp			: Math.floor(new Date().getTime()/1000.0), // convert milliseconds to seconds
				oauth_token				: oauth_token || null,
				oauth_verifier			: oauth_verifier || null,
				oauth_version			: "1.0"
			},
		baseString = method + "&" + encodeURIComponent(requestURL) + "&",
		oauthSignature,
		requestQueryString = "";

	// Append any extra querystring values to the request tokens
	if(queryKeyValues) {
		for(let token in queryKeyValues) {
			requestTokens[token] = queryKeyValues[token];
		}

		// Sort tokens
		requestTokens = (o => Object.keys(requestTokens).sort().reduce((acc, cur) => (acc[cur] = requestTokens[cur], acc), {}))();
	}

	const lastToken = Object.keys(requestTokens)[Object.keys(requestTokens).length-1];

	for(let token in requestTokens) {
		// tokens to include in signature (include all)
		if(requestTokens[token] !== null) {
			baseString += token + encodeURIComponent("=" + requestTokens[token] + (token !== lastToken ? "&" : ""));
		}
	}

	oauthSignature = crypto.createHmac("sha1", apiCreds.secret + "&" + (oauth_token_secret && oauth_token_secret !== null ? oauth_token_secret : "")).update(baseString).digest().toString('base64');

	for(let token in requestTokens) {
		if(requestTokens[token] !== null) {
			requestQueryString += token + "=" + encodeURIComponent(requestTokens[token]) + "&";
		}
	}

	return (requestQueryString + "oauth_signature=" + encodeURIComponent(oauthSignature));
}

 async function requestToken(url) {
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

exports.getRequestTokenQueryString = getRequestTokenQueryString;
exports.requestToken = requestToken;
exports.getResponseKeyValues = getResponseKeyValues;