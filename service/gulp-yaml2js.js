const through = require('through2')
const yaml = require('js-yaml')

module.exports = function (env = 'development') {
  return through.obj((file, encoding, callback) => {
    const yamlJson = yaml.safeLoad(file.contents.toString());
    let config = {};
    for (const k in yamlJson) {
      if (yamlJson.hasOwnProperty(k)) {
        if (typeof yamlJson[k] === 'object') {
          if (k === env) {
            config = Object.assign({}, config, yamlJson[k]);
          }
        } else {
          config[k] = yamlJson[k];
        }
      }
    }
    const content = `const config = ${JSON.stringify(config)}; export default config; `;
    file.contents = Buffer.from(content, 'utf8');
    file.base = file.cwd;
    file.path = 'config/index.js';
    callback(null, file);
  })
}