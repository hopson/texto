/*
The contents of this file are subject to the Mozilla Public
License Version 1.1 (the "License"); you may not use this file
except in compliance with the License. You may obtain a copy of
the License at http://www.mozilla.org/MPL/

Software distributed under the License is distributed on an "AS
IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
implied. See the License for the specific language governing
rights and limitations under the License.

Alternatively, the contents of this file may be used under the
terms of the GNU General Public License Version 2 or later (the
"GPL"), in which case the provisions of the GPL are applicable 
instead of those above.

Copyright (C) 2002 Tomas Styblo <tripie@cpan.org>
*/

var texto_prefs = Components.classes["@mozilla.org/preferences-service;1"].
    getService(Components.interfaces.nsIPrefService).getBranch("texto.");
var dbConn = null;
var texto_domain_prefs = null;
var GLOBAL_QUERY_STATUS_THINGY = 0;

/* DEBUG */
var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                   .getService(Components.interfaces.nsIConsoleService);
/* END DEBUG */

function textoReadPref(name) {
	if(name.indexOf('texto.') == 0){
		name = name.substring('texto.'.length);
	}

    if (texto_prefs.prefHasUserValue(name)) {
        var type = texto_prefs.getPrefType(name);
        if (type & 128) {
            return texto_prefs.getBoolPref(name);
        }
        else if (type & 64) {
            return texto_prefs.getIntPref(name);
        }
        else if (type & 32) {
            return texto_prefs.getCharPref(name);
        }
        else {
            return null;
        }
    }
    else {
        return null;
    }
}

function initMozexPrefPanel(defaults) {
	var nodes = defaults.querySelectorAll('textbox');
	for(var i=0; i<nodes.length; i++){
		var node = nodes.item(i);
		node.value = textoReadPref(node.id);
		node.addEventListener("blur", function(e){  updateMozexPref(e.target); return true; }, true);
	}
	// handle the little checkbox:
	var gd = document.getElementById("texto.default.enabled");
	gd.checked = textoReadPref(gd.id);
	gd.addEventListener("command",
			function(e){ texto_prefs.setBoolPref("default.enabled", gd.checked); return true; },
			true);

	// handler for add button:
	var addButt = document.getElementById("texto.domain.add");
	var domainField = document.getElementById("texto.domain.new");
	addButt.addEventListener("command",
			function(e){
				var obj = { 'textoOptEnabled' : true };
				addExtensionPrefObj(domainField.value, 'texto', obj, function(){ insertNewDomain(domainField.value, JSON.stringify(obj), true); domainField.value = 'New Domain'; }); return true; },
			true);
	domainField.addEventListener("focus", function(e){ domainField.value = ""; return true; }, true);

	// delete button:
	var delButt = document.getElementById("textoOptDelete");
	delButt.addEventListener("command",
			function(e){
				delDomainPref(document.getElementById("textoOptDomain").value, 'texto', function(){ var n = document.getElementById("texto.domain.list"); n.removeChild(n.childNodes[n.selectedIndex]); resetDomainPrefDialog(); });
				return true; },
			true);
	// save button:
	var saveButt = document.getElementById("textoOptSave");
	saveButt.addEventListener("command",
			function(e){
				// what we are gonna do here is save this thing
				// get the "domain" value
				var domain = document.getElementById("textoOptDomain").value;
				// build the json object
				var jsonObj = {};
				var opts = {"textoOptEditor":'value', "textoOptArgs":'value', "textoOptAuto":'value', "textoOptEnabled":'checked'};
				for(var o in opts){ jsonObj[o] = document.getElementById(o)[opts[o]]; }
				var jsonStr = JSON.stringify(jsonObj);
				// save it all
				addDomainPrefStr(
					domain,
					'texto',
					jsonStr,
					function(){
						var list = document.getElementById('texto.domain.list');
						list.childNodes[list.selectedIndex].value = jsonStr;
						});
				return true;
			},
			true);

	// browse for app dialog
	var appButt = document.getElementById("texto.default.editorbrowse");
	appButt.addEventListener(
			'command',
			function(e){ textoAppPicker(e, document.getElementById('texto.default.editor')); return true; },
			true);
	var domainButt = document.getElementById("texto.domain.editorbrowse");
	domainButt.addEventListener(
			'command', 
			function(e){ textoAppPicker(e, document.getElementById('textoOptEditor')); return true; },
			true);
	initDomainListing();
	resetDomainPrefDialog();
}
function textoAppPicker(e, field){
	var nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
	fp.init(window, "Select a File", nsIFilePicker.modeOpen);
	var plat = window.navigator.platform.toLowerCase();
	var localDir = null;
	if(plat.indexOf("mac") != -1){
		//localDir.initWithPath("LocApp");
		localDir = Components.classes["@mozilla.org/file/directory_service;1"].
			getService(Components.interfaces.nsIProperties).
			get("LocApp", Components.interfaces.nsIFile);

	} else if(plat.indexOf("win") != -1){
		//localDir.initWIthPath("ProgF");
		localDir = Components.classes["@mozilla.org/file/directory_service;1"].
			getService(Components.interfaces.nsIProperties).
			get("ProgF", Components.interfaces.nsIFile);

	}
	if(localDir){ fp.displayDirectory = localDir; }
	fp.appendFilters(nsIFilePicker.filterApps);

	var result = fp.show();
	if(result == nsIFilePicker.returnOK) {
		field.value = fp.file.path;
		// focus because we use blur event to save changes:
		field.focus();
	}
}

function insertNewDomain(domain, value, andScroll){
	var listbox = document.getElementById("texto.domain.list");
	var indent = "";
	var rdomain = urlReverse(domain);
	for(var i = 0; i < listbox.childNodes.length; i++){
		if(typeof(listbox.childNodes[i].label) == "undefined"){
			continue;
		}
		if(isSubdomain(listbox.childNodes[i].label, domain)){
			indent += "  ";
		}
		if(domainCmp(domain,listbox.childNodes[i].label) == -1){
			// insert domain at index 'i'
			break;
		}
	}
	var newitem = listbox.insertItemAt(i, indent + domain, value);
	if(typeof(andScroll) != 'undefined'){
		listbox.ensureElementIsVisible(newitem);
		listbox.selectItem(newitem);
	}
	return;
}

function initDomainListing(focusEl){
	var lb = document.getElementById('texto.domain.list');
	if(lb == null){ return; }
	getExtensionPrefList('texto',
		function(prefList){
			texto_domain_prefs = prefList;
			while(lb.hasChildNodes()){
				lb.removeChild(lb.firstChild);
			}
			for(var p in prefList){
				insertNewDomain(urlReverse(p), prefList[p]);
			}
			if(focusEl){
				item = lb.querySelector("listitem[value='" + focusEl + "']");
				if(item){
					lb.ensureElementIsVisible(item);
					lb.selectItem(item);
				}
			}
		}
	);
	lb.addEventListener("select",
			function(e){ var t = e.target; var n = t.childNodes[t.selectedIndex]; showDomainPrefDialog(n.label, n.value); return true; },
			true);

}

function showDomainPrefDialog(domain, jsonStr) {
	var jsonObj = JSON.parse(jsonStr);
	document.getElementById("textoOptDomain").value = domain;
	document.getElementById("textoOptDelete").disabled = false;
	document.getElementById("textoOptSave").disabled = false;
	document.getElementById("textoOptEditor").disabled = false;
	document.getElementById("textoOptAuto").disabled = false;
	document.getElementById("textoOptEnabled").disabled = false;
	document.getElementById("textoOptArgs").disabled = false;
	document.getElementById("texto.domain.editorbrowse").disabled = false;

	var opts = {textoOptEditor:'value', textoOptArgs:'value', textoOptAuto:'value', textoOptEnabled:'checked'};
	for(var i in opts){
		var node = document.getElementById(i);
		if(typeof(jsonObj[i]) != "undefined"){
			node[opts[i]] = jsonObj[i];
		} else {
			node[opts[i]] = '';
		}
	}

}

function resetDomainPrefDialog(){
	showDomainPrefDialog("", JSON.stringify({textoOptEditor:'', textoOptArgs:'', textoOptAuto:'', textoOptEnabled:false}));
	document.getElementById("textoOptDelete").disabled = true;
	document.getElementById("textoOptSave").disabled = true;
	document.getElementById("textoOptEditor").disabled = true;
	document.getElementById("textoOptAuto").disabled = true;
	document.getElementById("textoOptEnabled").disabled = true;
	document.getElementById("textoOptArgs").disabled = true;
	document.getElementById("texto.domain.editorbrowse").disabled = true;
}


function updateMozexPref(prefBox) {
	if(prefBox.id.indexOf('texto.') != 0){ return; }
	var prefName = prefBox.id.substring('texto.'.length);
	texto_prefs.setCharPref(prefName, prefBox.value);
}

function changeMozexPrefs(el) {
    texto_prefs.setCharPref("command.textarea", document.getElementById("prefMozexTextareaEditor").value);
}


/* 
 * Domain Database handling functions
 */

function initDomainDb(){

	// Domain Database Querying:
	var file = Components.classes["@mozilla.org/file/directory_service;1"]
						 .getService(Components.interfaces.nsIProperties)
						 .get("ProfD", Components.interfaces.nsIFile);
	file.append("domain_prefs.sqlite");
	var storageService = Components.classes["@mozilla.org/storage/service;1"]
							.getService(Components.interfaces.mozIStorageService);
	dbConn = storageService.openDatabase(file); // Will also create the file if it does not exist
	if(dbConn){
		dbConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS domain_options (domain TEXT, extension TEXT, create_date TEXT DEFAULT CURRENT_TIMESTAMP, modify_date TEXT DEFAULT CURRENT_TIMESTAMP, jsonblob BLOB, PRIMARY KEY(domain ASC, extension ASC))");
	}
}

function getExtensionPrefList(extension, callback){
	var mycallback = function(jsonObj){ callback(jsonObj[extension]); }
	var rowcount = 0;
	var jsonList = Array();

	if(dbConn == null) { initDomainDb(); }
	var stmt = dbConn.createStatement("SELECT * FROM domain_options WHERE extension = :extension ORDER BY domain ASC");
	stmt.params.extension = extension;
	stmt.executeAsync({
		handleResult: function(resultSet){
			for(var row = resultSet.getNextRow(); row; row = resultSet.getNextRow()) {
				var jsonStr = row.getResultByName("jsonblob");
				var domain = row.getResultByName("domain");
				jsonList[domain] = jsonStr;
			}
			GLOBAL_QUERY_STATUS_THINGY = 1;
			callback(jsonList);
		},
		handleError: function(err){ alert("Error: " + err.message); },
		handleCompletion: function(reason){
			if(reason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED){ print("Query cancelled or aborted"); }
			else { if(GLOBAL_QUERY_STATUS_THINGY == 0){ callback(Array()); } else GLOBAL_QUERY_STATUS_THINGY = 0; }
			},
	});
}

function getDomainPrefStr(domain, extension, callback){
	if(dbConn == null){ initDomainDb(); }
	var jsonStr = "{}";
	var stmt = dbConn.createStatement("SELECT * FROM domain_options WHERE extension = :extension AND :domain LIKE domain_options.domain||'%' ORDER BY domain_options.domain DESC");
	stmt.params.extension = extension;
	stmt.params.domain = urlReverse(domain);
	stmt.executeAsync({
		handleResult: function(resultSet){
			var row = resultSet.getNextRow();
			jsonStr = row.getResultByName("jsonblob");
			GLOBAL_QUERY_STATUS_THINGY = 1;
			callback(jsonStr);
		},
		handleError: function(err){ alert("Error: " + err.message); },
		handleCompletion: function(reason){
			if(reason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED){ alert("Query cancelled or aborted"); }
			else { if(GLOBAL_QUERY_STATUS_THINGY == 0){ callback(jsonStr); } else GLOBAL_QUERY_STATUS_THINGY = 0; }
			},
	});
}

function addExtensionPrefObj(domain, extension, obj, callback){
	var mycallback = function(jsonObj){
		addDomainPrefStr(domain, extension, JSON.stringify(obj), callback);
	}
	getDomainPrefStr(domain, extension, mycallback);
}

function addDomainPrefStr(domain, extension, jsonStr, callback){
	if(dbConn == null){ initDomainDb(); }
	var rdomain = urlReverse(domain);
	var stmt = dbConn.createStatement("REPLACE INTO domain_options (domain, extension, jsonblob) VALUES(:domain, :extension, :jsonblob)");
	stmt.params.domain = rdomain;
	stmt.params.jsonblob = jsonStr;
	stmt.params.extension = extension;
	stmt.executeAsync({
		handleResult: function(resultSet){},
		handleError: function(err){ alert("Error saving: " + err.message); },
		handleCompletion: function(reason){ callback(); },
	});
}

function delDomainPref(domain, extension, callback){
	if(dbConn == null){ initDomainDb(); }
	var rdomain = urlReverse(domain);
	var stmt = dbConn.createStatement("DELETE FROM domain_options WHERE domain = :domain AND extension = :extension");
	stmt.params.domain = rdomain;
	stmt.params.extension = extension;
	stmt.executeAsync({
		handleError: function(err){ alert("Error saving: " + err.message); },
		handleCompletion: function(reason){ callback(); },
	});

}

/*
 * URL handling functions
 */

function urlReverse(url) {
	var urlObj = parseUrl(url);
	var rparts = urlObj.host.split("").reverse();
	var rdomain = rparts.join("");
	return rdomain + urlObj.path;
}

function strcmp(a, b){ return ( ( a == b ) ? 0 : ( ( a > b ) ? 1 : -1 ) ); }

function parseUrl(url){
	var urlObj = {};
	urlObj.orig = url;
	var slash = url.indexOf('/');
	if(slash == -1){
		urlObj.host = url;
		urlObj.path = "";
	} else {
		urlObj.host = url.substr(0, slash);
		urlObj.path = url.substr(slash);
	}
	urlObj.hostparts = urlObj.host.split(".");
	if(urlObj.hostparts.length == 1){
		urlObj.domain = urlObj.host;
	} else {
		var l = urlObj.hostparts.length;
		urlObj.domain = urlObj.hostparts[l - 2] + '.' + urlObj.hostparts[l - 1];
	}
	return urlObj;
}


function isSubdomain(domain, subdomain){
	if(domain.length >= subdomain.length){ return false; }
	var idx = subdomain.indexOf(domain);
	if(idx == 0 && subdomain.substr(domain.length, 1) == '.'){
		return true;
	}
	return false;
}

function domainCmp(a, b){
	if(a == b) return 0;

	var aUrl = parseUrl(a);
	var bUrl = parseUrl(b);

	// if the hosts are the same, sort by just path:
	if(aUrl.host == bUrl.host){ return strcmp(aUrl.path, bUrl.path); }

	var maxlen = (aUrl.hostparts.length > bUrl.hostparts.length) ? aUrl.hostparts.length : bUrl.hostparts.length;
	// if the domains are different, sort by them
	if(aUrl.domain != bUrl.domain){ return strcmp(aUrl.domain, bUrl.domain); }

	// then descend until we find a difference
	for(var i = maxlen - 2; i >= 0; i--){
		if(typeof(aUrl.hostparts[i]) == "undefined"){
			if(typeof(bUrl.hostparts[i]) == "undefined"){ return 0; }
			else { return -1; }
		} else {
			if(typeof(bUrl.hostparts[i]) == "undefined"){ return 1; }
			else if(aUrl.hostparts[i] != bUrl.hostparts[i]){
				return strcmp(aUrl.hostparts[i], bUrl.hostparts[i]);
			}
			// itentionally no 'else'; loop if equal
		}
	}

	// we already checked for a.host == b.host, so we never get here, right?
	// return 0 to "safely" do nothing
	return 0;
}


