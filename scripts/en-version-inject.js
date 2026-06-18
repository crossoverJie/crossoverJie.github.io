'use strict';

const path = require('path');

hexo.extend.filter.register('theme_inject', function(injects) {
  injects.postMarkdownBegin.file('en_version', path.join(hexo.theme_dir, 'layout/_partials/post/en-version.ejs'));
}, -98);
