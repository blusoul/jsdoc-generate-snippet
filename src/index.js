const taffy = require('taffydb').taffy;
const handleDocsData = require('./utils');

exports.handlers = {
  // jsdoc parse processing Complete
  processingComplete({ doclets }) {
    const docs = taffy(doclets)()
      .get()
      .filter((doc) => {
        return !doc.undocumented;
      });
    console.log(docs);
    handleDocsData(docs);
  },
};

exports.defineTags = function defineTags(dictionary) {
  // defined snippet Tag
  dictionary.defineTag('snippet', {
    canHaveName: false,
    onTagged(doclet, tag) {
      doclet.snippet = tag.value;
    },
  });
};
