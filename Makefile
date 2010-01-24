#!/usr/bin/make

EXTENSION=mozex

XPI_FILE=$(EXTENSION).xpi

#BLEAH_JAR_CONTENTS=chrome/content/mozex-testo/communicatorOverlay.xul chrome/content/mozex-testo/md5.js chrome/content/mozex-testo/mozex-testo.js chrome/content/mozex-testo/mozex-testo.xul chrome/content/mozex-testo/mozex-testo-PrefDialog.xul chrome/content/mozex-testo/mozex-testo-PrefOverlay.xul chrome/content/mozex-testo/platformPrefOverlay.xul chrome/content/mozex-testo/pref-mozex-testo.js chrome/content/mozex-testo/pref-mozex-testo.xul chrome/content/mozex-testo/mozex-bg.png chrome/content/mozex-testo/mozex-edit.png chrome/content/mozex-testo/mozex-open.png

#JAR_CONTENTS=chrome/content/$(EXTENSION)/communicatorOverlay.xul chrome/content/$(EXTENSION)/md5.js chrome/content/$(EXTENSION)/mozex-bg.png chrome/content/$(EXTENSION)/mozex-edit.png chrome/content/$(EXTENSION)/mozex-open.png chrome/content/$(EXTENSION)/mozex.js chrome/content/$(EXTENSION)/mozex.xul chrome/content/$(EXTENSION)/mozexPrefOverlay.xul chrome/content/$(EXTENSION)/platformPrefOverlay.xul chrome/content/$(EXTENSION)/pref-mozex.js chrome/content/$(EXTENSION)/pref-mozex.xul

XUL_CONTENTS=chrome/content/$(EXTENSION)/communicatorOverlay.xul chrome/content/$(EXTENSION)/mozex.xul chrome/content/$(EXTENSION)/mozexPrefOverlay.xul chrome/content/$(EXTENSION)/platformPrefOverlay.xul chrome/content/$(EXTENSION)/pref-mozex.xul
JS_CONTENTS=chrome/content/$(EXTENSION)/md5.js chrome/content/$(EXTENSION)/mozex.js chrome/content/$(EXTENSION)/pref-mozex.js
OTHER_CONTENTS=chrome/content/$(EXTENSION)/mozex-bg.png chrome/content/$(EXTENSION)/mozex-edit.png chrome/content/$(EXTENSION)/mozex-open.png




JAR_FILE=$(EXTENSION).jar

xpi: jar install.rdf
	zip $(XPI_FILE) install.rdf chrome.manifest $(JAR_FILE)

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
	rm -f $(JAR_FILE)

