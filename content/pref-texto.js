/*
 * vim:set ts=4 sw=4 sts=4 expandtab: 
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
var GLOBAL_QUERY_STATUS_THINGY = 0;

// borrowed from FUEL
// see http://doxygen.db48x.net/mozilla/html/interfacensIExtensionManager.html
var myinfo = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager).getItemForID('texto@hopson.ws');
//for(var thing in myinfo){ alert(thing + ": " + myinfo[thing]); }

var pref = "texto.default";
var textopref = {
    tmpdir: pref + ".tmpdir",
    enabled: pref + ".enabled",
    editor: pref + ".editor",
    args: pref + ".args",
    file_extension: pref + ".file_extension",
    selector: pref + ".selector",
    iconpos: pref + ".iconpos",
    iconhide: pref + ".iconhide",
};

var textoDomainPrefs = {
    textoOptEditor: { val: 'value', watch: 'blur', default: '', global: textopref.editor},
    textoOptArgs: { val: 'value', watch: 'blur', default: '', global: textopref.args},
    textoOptAuto: { val: 'value', watch: 'blur', default: '', global: textopref.selector},
    textoOptEnabled: { val: 'checked', watch: 'command', default: false, global: textopref.enabled },
    textoOptExtension: { val: 'value', watch: 'blur', default: '', global: textopref.file_extension },
    textoOptTmpDir: { val: 'value', watch: 'blur', default: '', global: textopref.tmpdir },
    textoOptIcon: { val: 'value', watch: 'command', default: 2, global: textopref.iconpos },
    textoOptIconHide: { val: 'value', watch: 'command', default: 0, global: textopref.iconhide },
};

/* DEBUG */
var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                    .getService(Components.interfaces.nsIConsoleService);
/* END DEBUG */

function $(id){ return document.getElementById(id); }

function textoReadPref(name) {
    if(name.indexOf('texto.') == 0){
        name = name.substring('texto.'.length);
    }

    if (texto_prefs.prefHasUserValue(name)) {
        var type = texto_prefs.getPrefType(name);
        if (type & 128) { return texto_prefs.getBoolPref(name); }
        else if (type & 64) { return texto_prefs.getIntPref(name); }
        else if (type & 32) { return texto_prefs.getCharPref(name); }
        else { return null; }
    } else { return null; }
}

function textoSetPref(name, value) {
    if(name.indexOf('texto.') == 0){ name = name.substring('texto.'.length); }
    if (texto_prefs.prefHasUserValue(name)) {
        var type = texto_prefs.getPrefType(name);
        if (type & 128){ return texto_prefs.setBoolPref(name, value); }
        else if (type & 64) { return texto_prefs.setIntPref(name, value); }
        else if (type & 32) { return texto_prefs.setCharPref(name, value); }
        else { return null; }

    } else if(value) {
        // guess the type, if there is a value
        if(typeof(value) === 'boolean') {
            return texto_prefs.setBoolPref(name, value);
        } else if ( (parseInt(value) + "") == value) {
            // not using typeof so "1" is converted to int
            return texto_prefs.setIntPref(name, parseInt(value));
        } else {
            return texto_prefs.setCharPref(name, value);
        }
    }
}

function initTextoPrefPanel(defaults) {
    var nodes = defaults.querySelectorAll('textbox');
    for(var i=0; i<nodes.length; i++){
        var node = nodes.item(i);
        node.value = textoReadPref(node.id);
        node.addEventListener("blur", function(e){  updateTextoPref(e.target); return true; }, true);
    }
    // handle the little checkbox:
    var gd = $("texto.default.enabled");
    gd.checked = textoReadPref(gd.id);
    gd.addEventListener("command",
            function(e){ textoSetPref("default.enabled", gd.checked); return true; },
            true);

    // handler for add button:
    var addButt = $("texto.domain.add");
    var domainField = $("texto.domain.new");
    addButt.addEventListener("command",
            function(e){
            var obj = { 'textoOptEnabled' : true };
            addExtensionPrefObj(domainField.value, 'texto', obj, function(){ insertNewDomain(domainField.value, JSON.stringify(obj), true); domainField.value = 'New Domain'; }); return true; },
            true);
    domainField.addEventListener("focus", function(e){ resetDomainPrefDialog(); domainField.value = ""; return true; }, true);

    // delete button:
    var delButt = $("textoOptDelete");
    delButt.addEventListener("command",
            function(e){
            if(confirm("Are you sure you want to delete settings for " + $('textoOptDomain').value + "?")){
                delDomainPref($("textoOptDomain").value, 'texto', function(){ var n = $("texto.domain.list"); n.removeChild(n.childNodes[n.selectedIndex]); resetDomainPrefDialog(); });
                return true; }
            else { return false } },
            true);
    // browse for app dialog
    var appButt = $("texto.default.editorbrowse");
    appButt.addEventListener(
            'command',
            function(e){ textoAppPicker(e, $('texto.default.editor')); return true; },
            true);
    var domainButt = $("texto.domain.editorbrowse");
    domainButt.addEventListener(
            'command', 
            function(e){ textoAppPicker(e, $('textoOptEditor')); return true; },
            true);
    for(var field in textoDomainPrefs){
        var f = $(field);
        if(f != null){
            f.addEventListener(textoDomainPrefs[field].watch, function(e){ d = $('textoOptDomain').value; return saveDomainPrefs(d); }, true);
        }
    }

    // icon position
    var iconpos = $("texto.iconpos");
    iconpos.addEventListener(
            'command',
            function(e){ textoSetPref('default.iconpos', e.target.value); return true; },
            true);

    // hide icon?
    var iconhide = $("texto.iconhide");
    iconhide.addEventListener(
            'command',
            function(e){ textoSetPref('default.iconhide', e.target.value); return true; },
            true);

    initDomainListing();
    resetDomainPrefDialog();
    initDisplayPrefs();
}

function initDisplayPrefs(){
    // select the radio button indicated by pref
    $('texto.iconpos').selectedIndex = textoReadPref(textopref.iconpos) - 1;
    $('texto.iconhide').selectedIndex = textoReadPref(textopref.iconhide);

}

function saveDomainPrefs(domain){
    var curDomain = $("textoOptDomain").value;

    // this madness is because the domain list "select" event fires
    // before the "blur" event I use to save changes, and since "select"
    // changes teh value of 
    if(curDomain == '' || ( (domain != null) && (curDomain != domain) ) ){
        return true;
    }
    // build the json object
    var jsonObj = {};
    for(var o in textoDomainPrefs){
        var n = $(o);
        if(n){ jsonObj[o] = n[textoDomainPrefs[o].val]; }
    }
    var jsonStr = JSON.stringify(jsonObj);

    // save it all
    addDomainPrefStr( curDomain, 'texto', jsonStr,
            function(){
                var list = $('texto.domain.list');
                // this is brute force and ugly:
                for(var i in list.childNodes){
                    if(list.childNodes[i].label == curDomain){
                        list.childNodes[i].value = jsonStr;
                        break;
                    }
                }
            });
    return true;
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
    var listbox = $("texto.domain.list");
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
    var lb = $('texto.domain.list');
    if(lb == null){ return; }
    getExtensionPrefList('texto',
            function(prefList){
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
            });
    lb.addEventListener("select",
            function(e){
                var t = e.target;
                var n = t.childNodes[t.selectedIndex];
                // do this because the blur event on the current form isn't fired yet
                saveDomainPrefs(null);
                showDomainPrefDialog(n.label, n.value);
                return true;
            },
            true);
}

function showDomainPrefDialog(domain, jsonStr) {
    var jsonObj = JSON.parse(jsonStr);

    $('textoOptDomain').value = domain;
    $("textoOptDelete").disabled = false;
    $("texto.domain.editorbrowse").disabled = false;

    for(var i in textoDomainPrefs){
        var node = $(i);
        if(node == null) continue;

        node.disabled = false;
        if(typeof(jsonObj[i]) != "undefined"){
            node[textoDomainPrefs[i].val] = jsonObj[i];
        } else {
            node[textoDomainPrefs[i].val] = '';
        }
    }
}

function resetDomainPrefDialog(){
    var obj = {}
    for(var i in textoDomainPrefs){ obj[i] = textoDomainPrefs[i].default; }
    showDomainPrefDialog("", JSON.stringify(obj));

    for(var i in textoDomainPrefs){
        var n = $(i);
        if(n != null){ $(i).disabled = true; }
    }
    $("textoOptDelete").disabled = true;
    $("texto.domain.editorbrowse").disabled = true;
}


function updateTextoPref(prefBox) {
    if(prefBox.id.indexOf('texto.') != 0){ return; }
    var prefName = prefBox.id.substring('texto.'.length);
    textoSetPref(prefName, prefBox.value);
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

function getMergedPrefObj(domain, extension, callback){
    getDomainPrefStr(domain, extension, function(jsonStr){
        jsonObj = JSON.parse(jsonStr);
        for(var f in textoDomainPrefs){
            if(jsonObj[f] == null || (typeof(jsonObj[f]) == 'string' && jsonObj[f] == '') ){
                jsonObj[f] = textoReadPref(textoDomainPrefs[f].global);
            }
        }
        callback(jsonObj);
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


