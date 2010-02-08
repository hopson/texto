/*
vim:set ts=4 sw=4 sts=4 expandtab:

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

Copyright (C) 2003 Tomas Styblo <tripie@cpan.org>
*/

var texto_default_tmpdir = "/tmp";  /* unix */
var texto_dir_separator = '/';      /* unix */
var texto_os = 'unix';              /* unix */
if (window.navigator.platform.toLowerCase().indexOf("win") != -1) {
    texto_default_tmpdir = "C:\\windows\\temp";     /* windows */
    texto_dir_separator = '\\';                     /* windows */
    texto_os = 'win';                               /* windows */
}

var texto_alert_error = "texto error: ";
var texto_tmpfiles_maxage = 3600 * 24; // in seconds
// var texto_tmpfiles_maxage = 3600; // in seconds
var hotKeyed = 0;

function textoGetPrefTmpdir() {
    var dir = textoReadPref("general.tmpdir");
    if (dir == null || dir.length == 0) {
        dir = texto_default_tmpdir;
    }

    if (! textoExistsFile(dir)) {
        textoError("temporary directory '" + dir + "' does not exist");
        return null;
    }
    return dir;
}

function textoTmpFilenameTextarea(textarea_node) {
    var tmpdir = textoGetPrefTmpdir();
    if (tmpdir) {
        var d = new Date();
        return tmpdir + texto_dir_separator + "texto.textarea." + 
           hex_md5(textarea_node.ownerDocument.URL + ':' + 
                   textarea_node.getAttribute("name")) + ".txt";
    }
    else {
        return null;
    }
}

function textoHandleMouseDown(evt) {
    var elem_type = null;
    var link_type = null;
    for(var node = evt.originalTarget; node != null; node = node.parentNode) {
        if(node.nodeType == Node.ELEMENT_NODE) {
            elem_type = node.localName.toUpperCase();
            if (elem_type == "TEXTAREA") {
                if (evt.button == 0 && 
                        textoExistsFile(textoTmpFilenameTextarea(node))) {
                    textoFillTextarea(node, true);
                    return false;
                }
                break;
            }
        }
    }
}

function textoPurgeTmpdir() {
    var files = textoReadDir(textoGetPrefTmpdir());
    files.QueryInterface(Components.interfaces.nsISimpleEnumerator);
    while (files.hasMoreElements()) {
        var f = files.getNext();
        f.QueryInterface(Components.interfaces.nsIFile);
        var d = new Date();
        if ((f.leafName.substr(0, 5) == "texto") && 
            (d.getTime() - f.lastModifiedTime > texto_tmpfiles_maxage * 1000)) {
            try {
                f.remove(false);
            }
            catch (e) {
                textoError("cannot delete temporary file '" + f.path + "': " + e);
            }
        }
    }
}

function textoRunProgram(context, cmd, esc, node) {
    if (cmd == null) {
        return false; // no command is set
    }
    var args = new Array();

    // parse arguments, honoring double-quoted strings
    var scmd = new Array();
    var in_quotes = false;
    var buf = '';
    for (var i = 0; i < cmd.length; i++) {
        var c = cmd[i];
        if (c == '"') {
            if (in_quotes) {
                scmd.push(buf);
                buf = '';
            }
            in_quotes = !in_quotes;
        } else if (c == ' ') {
            if (in_quotes) {
                buf = buf + c;
            } else {
                scmd.push(buf);
                buf = '';
            }
        } else {
            buf = buf + c;
        }
    }
    scmd.push(buf);

    var executable = scmd.shift();
    if (executable.length == 0) {
        textoError(context + ": no executable in command");
        return false;
    }

    for (var i = 0; i < scmd.length; i++) {
        var param = scmd[i];
        var buf = "";
        if (param.length == 0) {
            continue;
        }
        for (var e = 0; e < param.length; e++) {
            var c = param[e];
            if (c == '%') {
                var a = param[++e];
                if (esc[a] === undefined) {
                    textoError(context + ": unknown escape in command '" + cmd + "': %" + a);
                    return false;
                } else {
                    buf += esc[a];
                }
            } else {
                buf += c;
            }
        }
        args.push(buf);
    }

    try {
        var exec = Components.classes["@mozilla.org/file/local;1"].
                   createInstance(Components.interfaces.nsILocalFile);
        var pr = Components.classes["@mozilla.org/process/util;1"].
                 createInstance(Components.interfaces.nsIProcess);
        var path = null;

        // $PATH stuff (only on UNIX)
        if (texto_os == 'unix') {
            try {
                path = pr.getEnvironment("PATH").split(":");
            } catch (e) {
                // do nothing
            }
        }

        // If executable is an absolute path, run it or fail.  If not, then
        // look for it in $PATH.  FIXME: How do you tell portably if a path is
        // absolute?
        if (executable.charAt(0) == "/" || path == null) {
            exec.initWithPath(executable);
            if (! exec.exists()) {
                textoError(context + ": executable '" + executable + "' does not exist.");
                return false;
            } else if (window.navigator.platform.toLowerCase().indexOf("mac") != -1) {
                // on a mac, we might need to check inside .app bundles
                // Look for the Info.plist file:
                if(exec.isDirectory()){
                    var plist = Components.classes["@mozilla.org/file/local;1"].
                        createInstance(Components.interfaces.nsILocalFile);
                    plist_path = executable + texto_dir_separator + 'Contents' +
                        texto_dir_separator + 'Info.plist';
                    plist.initWithPath(plist_path);
                    if(plist.exists() && plist.isFile()){
                        // then we need to parse the plist file for executable name
                        var req = new XMLHttpRequest();
                        req.open("GET", "file://" + plist_path, false);
                        req.send(null);
                        var dom = req.responseXML;
                        var keyNodes = dom.querySelectorAll('plist>dict>key');
                        for(var i = 0; i < keyNodes.length; i++){
                            if(keyNodes[i].firstChild
                                    && keyNodes[i].firstChild.nodeType == Node.TEXT_NODE
                                    && keyNodes[i].firstChild.wholeText == "CFBundleExecutable") {
                                // then get the value:
                                nextNode = keyNodes[i].nextSibling;
                                // skip nuisance text nodes in between
                                while(nextNode.nodeType == Node.TEXT_NODE){ nextNode = nextNode.nextSibling; }
                                if(nextNode.tagName == "string"){
                                    executable = executable + texto_dir_separator + 'Contents' +
                                        texto_dir_separator + 'MacOS' + texto_dir_separator +
                                        nextNode.firstChild.wholeText;
                                    exec.initWithPath(executable);
                                }
                                break;
                            }
                        }
                    }
                }
            }
        } else {
            var found = false;
            for (i = 0; i < path.length; i++) {
                exec.initWithPath(path[i]);
                exec.appendRelativePath(executable);
                if (exec.exists()) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                textoError(context + ": could not find '" + executable + "' in path.");
                return false;
            }
        }

        pr.init(exec);
        // @todo Commented out for development:
        //pr.run(true, args, args.length);

        /* Notes
         * As of FF 3.6, this (runAsync) actually works correctly. Yay!
         * However, I need to really put in some thought on how to make it work.
         * Most GUI apps don't actually start up a second instance,
         * so waiting for an exit doesn't work.  :. it's commented out for now.
         */

        // Create an observer:
        observer = {
			observe: function(subject, topic, data){ 
				evt = document.createEvent("MouseEvents");
				evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
				node.dispatchEvent(evt);
				//alert(node);
			},
            register: function() {
                var observerService = Components.classes["@mozilla.org/observer-service;1"]
                    .getService(Components.interfaces.nsIObserverService);
                observerService.addObserver(this, "myTopicID", false);
            },
            unregister: function(){
                var observerService = Components.classes["@mozilla.org/observer-service;1"]
                    .getService(Components.interfaces.nsIObserverService);
                observerService.removeObserver(this, "myTopicID");

            }
        }
        pr.runAsync(args, args.length, observer);
    }
    catch (e) {
        textoError(context + ": cannot run executable '" +
                   executable + "' (args: " + args + "): " + e);
        return false;
    }
    return true;
}

function textoStartEditor(event, prefs) {
    if(event.target.tagName == "IMG"){
        var target = event.target.parentNode;
    } else {
        var target = event.target;
    }
    var node = target.nextSibling;

    node.setAttribute('texto-obg', node.style.background);
    node.style.background = 'url(chrome://texto/content/icon-lg-hi.png) gray no-repeat center';
    target.firstChild.setAttribute('src',"chrome://texto/content/corner-hi.png");
    target.firstChild.setAttribute('alt',"There are Mozex edits pending on this textarea");
    target.firstChild.setAttribute('title',"There are Mozex edits pending on this textarea");
    node.focus();
    textoEditTextarea(node, prefs);
    node.addEventListener('focus', textoUpdateTextarea, false);
    node.addEventListener('click', textoHandleMouseDown, false);
    if(event.preventDefault){ event.preventDefault(); }
    return false;
}

function textoEditTextarea(node, prefs) {
    textoPurgeTmpdir();

    var tmpfile = textoTmpFilenameTextarea(node);
    if (! tmpfile) {
        return;
    }

    if (node) {
        if (textoExistsFile(tmpfile)) {
            if (confirm("texto: This textarea already is being edited.\n" + 
                          "Do you want to start another instance of the editor ?\n" + 
                          "All data written in the previous instance will be lost.")) {
                textoDeleteFile(tmpfile);
            }
            else {
                return;
            }
        }
        if (textoWriteFile(node.value, tmpfile)) {
            // run the editor
            var esc = {
                't': tmpfile,
				'h': node.ownerDocument.location.host,
            };
            if (! textoRunProgram("edit textarea", prefs.textoOptEditor + " " + prefs.textoOptArgs, esc, node)) {
                textoDeleteFile(tmpfile);
            }
        }
    }
    else {
        textoError("no textarea node found");
    }
}

function textoUpdateTextarea(event) {
    textoFillTextarea(event.target, false);
    if(event.preventDefault){ event.preventDefault(); }
    return false;
}

function textoFillTextarea(node, delFile) {
    var tmpfile = textoTmpFilenameTextarea(node);
    if (delFile ) {
        if(! tmpfile) {
            alert("FillTextarea No tempfile: "+tmpfile);
            return false;
        }
        node.removeEventListener('focus', textoUpdateTextarea, false);
        node.removeEventListener('click', textoHandleMouseDown, false);
    }

    if (node && textoExistsFile(tmpfile)) {
        var data = textoReadFile(tmpfile);
        if (data != null) {
            node.value = data;
            if(delFile){
                textoDeleteFile(tmpfile);
                /* update the image to show we're not longer editing */
                var sib = node.previousSibling;
                if(sib != null && sib.hasAttribute('texto') && sib.hasChildNodes()) {
                    sib.firstChild.setAttribute('src',"chrome://texto/content/corner.png");
                    sib.firstChild.setAttribute('alt',"Click to edit");
                    sib.firstChild.setAttribute('title',"Click to edit");

                    if(node.hasAttribute('texto-obg')) {
                        node.style.background = node.getAttribute('texto-obg');
                        node.removeAttribute('texto-obg');
                    }
                }
            }
        }
        return true;
    } else {
        node.removeEventListener('focus', textoUpdateTextarea, false);
        node.removeEventListener('click', textoHandleMouseDown, false);

        return false;
    }
}

function textoReadDir(dirname) {
    var dir = Components.classes["@mozilla.org/file/local;1"].
               createInstance(Components.interfaces.nsILocalFile);
    dir.initWithPath(dirname);
    if (dir.isDirectory()) {
        return dir.directoryEntries;
    }
    else {
        textoError("path '" + dir + "' is not a directory");
    }
}

function textoDeleteFile(filename) {
    var file = Components.classes["@mozilla.org/file/local;1"].
               createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(filename);
    if (file.exists()) {
        try {
            file.remove(false);
        }
        catch (e) {
            textoError("cannot delete file '" + file.path + "': " + e);
        }
    }
}

function textoExistsFile(filename) {
    var file = Components.classes["@mozilla.org/file/local;1"].
               createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(filename);
    return file.exists();
}

function textoWriteFile(data, filename) {
    try {
        var file = Components.classes["@mozilla.org/file/local;1"].
                   createInstance(Components.interfaces.nsILocalFile);
        file.initWithPath(filename);
        try {
            /* raises an error if the file already exists */
            file.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);
        }
        catch (e) { 
            textoError("cannot create temporary file '" + filename + "': " + e); 
            return false;
        }

        var stream = Components.classes["@mozilla.org/network/file-output-stream;1"].
                     createInstance(Components.interfaces.nsIFileOutputStream);
        var PR_WRONLY = 0x02;
        stream.init(file, PR_WRONLY, 0600, 0);
        stream.write(data, data.length);
        stream.flush()
        stream.close();
    } 
    catch (e) {
        textoError("cannot write to file '" + filename + "':" + e);
        return false;
    }
    return true;
}

function textoReadFile(filename) {
    var MODE_RDONLY = 0x01;
    var PERM_IRUSR = 00400;

    try {
        var file = Components.classes["@mozilla.org/file/local;1"].
                   createInstance(Components.interfaces.nsILocalFile);
        file.initWithPath(filename);
        if (file.exists() && file.isReadable()) {
            var is = Components.classes["@mozilla.org/network/file-input-stream;1"].
                     createInstance(Components.interfaces.nsIFileInputStream);
            is.init(file, MODE_RDONLY, PERM_IRUSR, 0);
            var sis = Components.classes["@mozilla.org/scriptableinputstream;1"].
                createInstance(Components.interfaces.nsIScriptableInputStream);
            sis.init(is);
            var data = sis.read(sis.available());
            sis.close();
            is.close();
            return data;
        }
        else {
            textoError("temporary file '" + filename + "' does not exist or is not readable");
            return null;
        }
    }
    catch (e) {
        textoError("cannot read from temporary file '" + filename + "': " + e);
    }
    return null;
}

function textoError(msg) {
    alert(texto_alert_error + msg);
}

function texto_add_edit_button(node, prefs) {

    var sib = node.nextSibling;
    if(sib == null || sib.nodeType != Node.ELEMENT_NODE || ! sib.hasAttribute('texto')) {
        var newNode = window.content.document.createElement('a');

        newNode.addEventListener("click", function(e){ return textoStartEditor(e, prefs); }, true);

        if(!hotKeyed){
            newNode.setAttribute('accesskey', 'o');
            hotKeyed++;
        }
        newNode.setAttribute('texto',true);
        newNode.setAttribute('href','#');
        newNode.setAttribute('title','Click to edit');
        newNode.setAttribute('style','display:inline-block; border:solid 1px #999; padding: 2px 4px; margin-top: 4px; background: #DDD; vertical-align: top; -moz-border-radius: 4px; position:absolute; left:' + (node.clientWidth - 27) );

        var newContents = window.content.document.createElement('img');
        newContents.setAttribute('src','chrome://texto/content/corner.png');
        newContents.addEventListener('mouseover', function(e){  e.target.src = 'chrome://texto/content/corner-hi.png'; e.target.parentNode.style.background = '#BBC'; return true; }, true);
        newContents.addEventListener('mouseout', function(e){ e.target.src = 'chrome://texto/content/corner.png'; e.target.parentNode.style.background = '#DDD'; return true; }, true);
        newContents.setAttribute('alt','Click to edit');
        newContents.setAttribute('title','Click to edit');
        newContents.setAttribute('style','border:none;');
        newNode.appendChild(newContents);
        node.parentNode.insertBefore(newNode, node);
    }
}