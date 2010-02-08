#!/usr/bin/make

EXTENSION=mozex

XPI_FILE=$(EXTENSION).xpi
XPI_DEV=$(EXTENSION)-dev.xpi
JAR_FILE=$(EXTENSION).jar

CONTENTS=content

XUL_CONTENTS=$(CONTENTS)/communicatorOverlay.xul $(CONTENTS)/mozex.xul $(CONTENTS)/mozexPrefOverlay.xul $(CONTENTS)/platformPrefOverlay.xul $(CONTENTS)/pref-mozex.xul

JS_CONTENTS=$(CONTENTS)/md5.js $(CONTENTS)/mozex.js $(CONTENTS)/pref-mozex.js

OTHER_CONTENTS=$(CONTENTS)/mozex-nuevo-corner.png $(CONTENTS)/mozex-nuevo-corner-hi.png $(CONTENTS)/mozex-nuevo-bigicon.png $(CONTENTS)/mozex-nuevo-bigicon-hi.png

ROOT_CONTENTS=install.rdf chrome.manifest icon.png


xpi: jar install.rdf chrome.manifest-prod
	cp chrome.manifest-prod chrome.manifest
	zip $(XPI_FILE) $(ROOT_CONTENTS) $(JAR_FILE)

dev: jar_contents $(OTHER_CONTENTS) chrome.manifest-dev
	cp chrome.manifest-dev chrome.manifest
	zip $(XPI_DEV) $(ROOT_CONTENTS) $(XUL_CONTENTS) $(JS_CONTENTS) $(OTHER_CONTENTS)

jar: jar_contents $(OTHER_CONTENTS)
	rm -f $(JAR_FILE)
	zip $(JAR_FILE) $(XUL_CONTENTS) $(JS_CONTENTS) $(OTHER_CONTENTS)

jar_contents: xulcheck

jstest: $(JS_CONTENTS)
	@for JS in $(JS_CONTENTS); do \
	 	js -w -C -f $${JS}; \
	done;

xulcheck: $(XUL_CONTENTS)

clean:
	rm -f $(XPI_FILE)
	rm -f $(XPI_DEV)
	rm -f $(JAR_FILE)

