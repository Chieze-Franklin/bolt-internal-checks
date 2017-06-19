var errors = require("bolt-internal-errors");
var models = require("bolt-internal-models");
var utils = require("bolt-internal-utils");

var superagent = require('superagent');

const X_BOLT_APP_TOKEN = 'X-Bolt-App-Token';
const X_BOLT_USER_NAME = 'X-Bolt-User-Name'
const X_BOLT_USER_TOKEN = 'X-Bolt-User-Token';

var __getAppFromAppToken = function(apptkn, request) {
	for (var entry of request.contextToAppTokenMap) {
		if (entry[1] === apptkn) { //value === apptkn
			return entry[0]; //return key
		}
	}
}

module.exports = {
	forAdminRight: function(request, response, next){
		next(); //TODO: check if user has admin privilege
	},
	//checks for logged-in UI user
	forLoggedInUiUser: function(request, response, next){
		if (!utils.Misc.isNullOrUndefined(request.user)) {
			next();
		}
		else {
			var success = encodeURIComponent(request.protocol + '://' + request.get('host') + request.originalUrl);
			response.redirect('/login?success=' + success + '&no_query=true'); //we don't want it to add any query string
		}
	},
	//checks to be sure the app making this request is a system app
	forSystemApp: function(request, response, next){
		var apptkn;
		if (!utils.Misc.isNullOrUndefined(request.get(X_BOLT_APP_TOKEN))) {
			apptkn = request.get(X_BOLT_APP_TOKEN);
		}
		else {
			var error = new Error(errors['110']);
			response.end(utils.Misc.createResponse(null, error, 110));
			return;
		}

		var name = __getAppFromAppToken(apptkn, request);
		if (utils.Misc.isNullOrUndefined(name)) {
			var error = new Error(errors['113']);
			response.end(utils.Misc.createResponse(null, error, 113));
			return;
		}
		var appnm = utils.String.trim(name.toLowerCase());

		if (appnm == 'bolt') {
			//native views
			next();
		}
		else {
			models.app.findOne({ 
				name: appnm, system: true
			}, function(appError, app){
				if (!utils.Misc.isNullOrUndefined(appError)) {
					response.end(utils.Misc.createResponse(null, appError));
				}
				else if(utils.Misc.isNullOrUndefined(app)){
					var error = new Error(errors['504']);
					response.end(utils.Misc.createResponse(null, error, 504));
				}
				else{
					next();
				}
			});
		}
	},

	//gets the app name from the request
	getAppName: function(request, response, next){
		var apptkn;
		if (!utils.Misc.isNullOrUndefined(request.get(X_BOLT_APP_TOKEN))) {
			apptkn = request.get(X_BOLT_APP_TOKEN);
		}
		else {
			var error = new Error(errors['110']);
			response.end(utils.Misc.createResponse(null, error, 110));
			return;
		}

		var name = __getAppFromAppToken(apptkn, request);
		if (utils.Misc.isNullOrUndefined(name)) {
			var error = new Error(errors['113']);
			response.end(utils.Misc.createResponse(null, error, 113));
			return;
		}
		var appnm = utils.String.trim(name.toLowerCase());
		request.appName = appnm;

		next();
	},

	//checks if this app has the right to read from the collection in the database
	forDbAccess: function(request, response, next) {
		var apptkn;
		if (!utils.Misc.isNullOrUndefined(request.get(X_BOLT_APP_TOKEN))) {
			apptkn = request.get(X_BOLT_APP_TOKEN);
		}
		else {
			var error = new Error(errors['110']);
			response.end(utils.Misc.createResponse(null, error, 110));
			return;
		}

		var name = __getAppFromAppToken(apptkn, request);
		if (utils.Misc.isNullOrUndefined(name)) {
			var error = new Error(errors['113']);
			response.end(utils.Misc.createResponse(null, error, 113));
			return;
		}
		var appnm = utils.String.trim(name.toLowerCase());
		var dbOwner = request.body.db || request.body.app || appnm;

		models.collection.findOne({ name: request.params.collection, app: dbOwner }, function(collError, collection){
			if (!utils.Misc.isNullOrUndefined(collError)){
				response.end(utils.Misc.createResponse(null, collError));
			}
			else if(utils.Misc.isNullOrUndefined(collection)){
				var errUser = new Error(errors['703']);
				response.end(utils.Misc.createResponse(null, errUser, 703));
			}
			else {
				//allow the owner to pass
				if (appnm == collection.app.toLowerCase()) {
					next();
					return;
				}

				if (!utils.Misc.isNullOrUndefined(collection.tenants)) { //tenants allowed
					if ("*" == collection.tenants) { //every body is allowed
						next();
						return;
					}
					//there is a tenant list; are u listed?
					else if (collection.tenants.map(function(value){ return value.toLowerCase(); }).indexOf(appnm) > -1) {
						next();
						return;
					}
				}

				if (!utils.Misc.isNullOrUndefined(collection.guests)) { //guests allowed
					if ("*" == collection.guests) { //every body is allowed
						next();
						return;
					}
					//there is a guest list; are u invited?
					else if (collection.guests.map(function(value){ return value.toLowerCase(); }).indexOf(appnm) > -1) {
						next();
						return;
					}
				}

				var error = new Error(errors['704']);
				response.end(utils.Misc.createResponse(null, error, 704));
			}
		});
	},
	//gets the DB name from the request, and creates the request.db field to hold the value
	getDbName: function(request, response, next){
		if (!utils.Misc.isNullOrUndefined(request.body.db)) {
			request.db = request.body.db;
		}
		else if (!utils.Misc.isNullOrUndefined(request.body.app)) {
			request.db = request.body.app;
		}
		else {
			var apptkn;
			if (!utils.Misc.isNullOrUndefined(request.get(X_BOLT_APP_TOKEN))) {
				apptkn = request.get(X_BOLT_APP_TOKEN);
			}
			else {
				var error = new Error(errors['110']);
				response.end(utils.Misc.createResponse(null, error, 110));
				return;
			}

			var name = __getAppFromAppToken(apptkn, request);
			if (utils.Misc.isNullOrUndefined(name)) {
				var error = new Error(errors['113']);
				response.end(utils.Misc.createResponse(null, error, 113));
				return;
			}
			var appnm = utils.String.trim(name.toLowerCase());
			request.db = appnm;
		}

		next();
	},
	//checks if this app has the right to write to the collection in the database
	forDbOwner: function(request, response, next) {
		var apptkn;
		if (!utils.Misc.isNullOrUndefined(request.get(X_BOLT_APP_TOKEN))) {
			apptkn = request.get(X_BOLT_APP_TOKEN);
		}
		else {
			var error = new Error(errors['110']);
			response.end(utils.Misc.createResponse(null, error, 110));
			return;
		}

		var name = __getAppFromAppToken(apptkn, request);
		if (utils.Misc.isNullOrUndefined(name)) {
			var error = new Error(errors['113']);
			response.end(utils.Misc.createResponse(null, error, 113));
			return;
		}
		var appnm = utils.String.trim(name.toLowerCase());
		var dbOwner = request.body.db || request.body.app || appnm;

		models.collection.findOne({ name: request.params.collection, app: dbOwner }, function(collError, collection){
			if (!utils.Misc.isNullOrUndefined(collError)){
				response.end(utils.Misc.createResponse(null, collError));
			}
			else if(utils.Misc.isNullOrUndefined(collection)){
				var errUser = new Error(errors['703']);
				response.end(utils.Misc.createResponse(null, errUser, 703));
			}
			else {
				//allow the owner to pass
				if (appnm == collection.app.toLowerCase()) {
					next();
					return;
				}

				if (!utils.Misc.isNullOrUndefined(collection.tenants)) { //tenants allowed
					if ("*" == collection.tenants) { //every body is allowed
						next();
						return;
					}
					//there is a tenant list; are u listed?
					else if (collection.tenants.map(function(value){ return value.toLowerCase(); }).indexOf(appnm) > -1) {
						next();
						return;
					}
				}

				//no guests allowed

				var error = new Error(errors['704']);
				response.end(utils.Misc.createResponse(null, error, 704));
			}
		});
	}
};
