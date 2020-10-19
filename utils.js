const fs = require('jsdoc/fs');
const env = require('jsdoc/env');
const path = require('jsdoc/path');

// code-snippets Map
const snippetsMap = {};
const tagsMap = {};
const attributesMap = {};
const TYPE_LIST = ['string', 'number', 'boolean', 'array', 'function', 'object'];
const MD_TYPE_MAP = {
  params: '参数',
  props: '属性',
  event: '事件名',
  data: '数据',
  computed: '变量',
};

// json format
function jsonStringify(data, isPretty = true) {
  return JSON.stringify(data, null, 2 * isPretty);
}

// code-snippets placeholder
function dealSnippetBody({ snippet, name, count, options } = {}) {
  let result = snippet;
  if (typeof snippet === 'string' && snippet) {
    const reg = new RegExp(`(?<=${name}=")[^"]*(?=")`);
    if (reg.test(snippet)) {
      result = snippet.replace(reg, '${' + count + '|' + options.join(',') + '|}');
      return [count + 1, result];
    }
  }
  return [count, result];
}

// create Markdown Params
function createParems(type, params = []) {
  if (!(Array.isArray(params) && params.length)) {
    return '';
  }
  return `| ${type} ${MD_TYPE_MAP[type] || ''} | 类型 | 默认值 | 说明 |\n| :--- | :--- | :----- | :--- |\n${params
    .map((item) => {
      const { names = [] } = item.type || {};
      return `| ${item.name} | ${Array.isArray(names) && names.length ? names.join('\\|') : '-'} | ${
        item.defaultvalue || '-'
      } | ${item.description} |`;
    })
    .join('\n')}\n\n`;
}

// create Markdown Header
function createMarkdownHeader(name, file) {
  return `[${name} Component](${file}) \n\n`;
}

// create attributes
function createAttributes(data = {}, params = []) {
  const attributes = [];
  let { snippet: snippetResult = '' } = data;
  if (Array.isArray(params) && params.length) {
    let count = 1;
    params.forEach((item) => {
      if (item.name) {
        const { type: { names = [] } = {} } = item;
        const name = item.name.replace(/:$/, '');
        attributes.push(name);
        const hasType = Array.isArray(names) && names.length;
        const isType =
          hasType &&
          names.every((str = '') => {
            let type = str;
            if (str.includes('.')) {
              type = str.split('.')[0];
            }
            return TYPE_LIST.includes(type.toLowerCase());
          });
        const result = {
          description: item.description,
        };
        if (hasType) {
          if (isType) {
            result.type = names.join('|').toLowerCase();
          } else {
            result.options = names;
            if (typeof snippetResult === 'string' && snippetResult) {
              const arr = dealSnippetBody({
                name,
                count,
                options: names,
                snippet: snippetResult,
              });
              count = arr[0];
              snippetResult = arr[1];
            }
          }
        }
        result.description += '\n\n' + createParems('props', [item]);
        attributesMap[`${data.name}/${name}`] = result;
      }
    });
  }
  return [attributes, snippetResult];
}

/**
 * 
 * @param {string} dir file path 
 */
function createFile({ dir, fileName, data, message } = {}) {
  fs.mkPath(dir);
  const str = path.join(dir, fileName);
  fs.writeFileSync(str, jsonStringify(data));
  console.log('\033[42;30m DONE \033[40;32m ' + message + '，path: ' + path.join(env.pwd, str) + ' \033[0m');
}

/**
 * deal description
 * @param {String} str description
 * @returns {String}
 */
function dealDescription(str) {
  if (typeof str === 'string') {
    // jsdoc-vue 修改的 description 参数
    return str.split('</p></div></div> \n\n\n<')[0];
  }
  return str;
}

/**
 * set Vetur snippets config
 * @param {String} dir
 */function configVetur(dir) {
  const packagePath = path.join(env.pwd, 'package.json');
  const packagejson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  fs.writeFileSync(
    packagePath,
    jsonStringify({
      ...packagejson,
      vetur: {
        tags: `${dir}/tags.json`,
        attributes: `${dir}/attributes.json`,
      },
    })
  );
}

/**
 * deal doclets Array
 * @param {Array} arr  doclets Array
 */
module.exports = function handleDocsData(arr) {
  if (!(Array.isArray(arr) && arr.length)) {
    return console.warn('has no component or no jsdocs');
  }
  const { files } = arr[arr.length - 1];
  const { destination = '', isOnlyCodeSnippets = false } = env.conf.snippet || {};
  arr.forEach((item = {}, index) => {
    const { _isVueDoc, name = '', params = [] } = item;
    const description = dealDescription(item.description);
    const fileUrl = files[index];
    if (name) {
      const keys = Object.keys(item) || [];
      const list = [];
      let header = createMarkdownHeader(name, fileUrl);
      if (_isVueDoc) {
        keys.forEach((key) => {
          if (/_vue/.test(key) && Array.isArray(item[key])) {
            list.push(...item[key]);
            const paramType = key.split('_vue')[1].toLowerCase();
            header += createParems(paramType, item[key]);
          }
        });
      } else {
        list.push(...params);
        header += createParems('param', item[key]);
      }
      const [attributes, snippet] = createAttributes(item, list);
      tagsMap[name] = {
        name,
        attributes,
        description: `${description} \n\n ${header}`,
      };
      if (typeof snippet === 'string' && snippet) {
        snippetsMap[name] = {
          prefix: name,
          body: snippet.split('\n'),
          description,
        };
      }
    }
  });

  const outputDir = destination || './snippets';
  const dirName = env.pwd.split('/').slice(-1)[0];

  if (!isOnlyCodeSnippets) {
    createFile({
      dir: outputDir,
      fileName: 'tags.json',
      data: tagsMap,
      message: 'snippets tags create complete!',
    });
    createFile({
      dir: outputDir,
      fileName: 'attributes.json',
      data: attributesMap,
      message: 'snippets attributes create complete!',
    });
    // config Vetur
    configVetur(outputDir);
  }
  createFile({
    dir: './.vscode',
    fileName: `${dirName}.code-snippets`,
    data: snippetsMap,
    message: 'Vscode code-snippets create complete!',
  });
};
