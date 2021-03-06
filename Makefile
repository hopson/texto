#!/usr/bin/make

EXTENSION=texto

XPI_FILE=$(EXTENSION).xpi
XPI_DEV=$(EXTENSION)-dev.xpi
JAR_FILE=$(EXTENSION).jar

CONTENTS=content

XUL_CONTENTS=$(CONTENTS)/communicatorOverlay.xul $(CONTENTS)/texto.xul $(CONTENTS)/textoPrefOverlay.xul $(CONTENTS)/platformPrefOverlay.xul $(CONTENTS)/pref-texto.xul $(CONTENTS)/pref-commands.xul $(CONTENTS)/pref-display.xul
JS_CONTENTS=$(CONTENTS)/md5.js $(CONTENTS)/texto.js $(CONTENTS)/pref-texto.js
CSS_CONTENTS=$(CONTENTS)/pref-texto.css
OTHER_CONTENTS=$(CONTENTS)/corner.png $(CONTENTS)/corner-hi.png $(CONTENTS)/icon-lg.png $(CONTENTS)/icon-lg-hi.png
LOCALES=$(CONTENTS)/locale

ROOT_CONTENTS=install.rdf chrome.manifest icon.png


xpi: jar install.rdf chrome.manifest-prod
	cp chrome.manifest-prod chrome.manifest
	zip $(XPI_FILE) $(ROOT_CONTENTS) $(JAR_FILE)

dev: jar_contents $(OTHER_CONTENTS) chrome.manifest-dev
	cp chrome.manifest-dev chrome.manifest
	zip -r $(XPI_DEV) $(ROOT_CONTENTS) $(LOCALES) $(XUL_CONTENTS) $(JS_CONTENTS) $(CSS_CONTENTS) $(OTHER_CONTENTS)

jar: jar_contents $(OTHER_CONTENTS)
	rm -f $(JAR_FILE)
	zip -r $(JAR_FILE) $(XUL_CONTENTS) $(LOCALES) $(JS_CONTENTS) $(CSS_CONTENTS) $(OTHER_CONTENTS)

jar_contents: $(JS_CONTENTS) $(LOCALES) xulcheck

jstest: $(JS_CONTENTS)
	@for JS in $(JS_CONTENTS); do \
	 	js -w -C -f $${JS}; \
	done;

xulcheck: $(XUL_CONTENTS)

clean:
	rm -f $(XPI_FILE)
	rm -f $(XPI_DEV)
	rm -f $(JAR_FILE)

