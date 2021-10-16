const through = require('through2')
const path = require('path')

module.exports = function (alias = {}) {
  return through.obj((file, _, callback) => {
    if (file.isNull()) {
      callback(undefined, file);
      return;
    }
    const aliasNames = Object.keys(alias)
    if (!aliasNames.length) {
      callback(undefined, file);
      return;
    }
    const aliasStr = aliasNames.join('|')
    const importReg = new RegExp(`import\\s*\\{?\\s*.*\\s*\\}?(?:\\s*from\\s*)?['"](${aliasNames.join('|')})(?:\\/[\\w_.-]+)*['"]`, 'ig');

    let contents = file.contents.toString()
    const cwd = file.cwd
    contents = contents.replace(importReg, (m, key) => {
      const aliasPath = path.resolve(cwd, alias[key])
      let aliasRelative = path.relative(path.dirname(file.path), aliasPath)
      
      if (path.sep === '\\') {
        aliasRelative = aliasRelative.split(path.sep).join('/')
      }
      aliasRelative = /^\./.test(aliasRelative) ? aliasRelative : `./${aliasRelative}`
      return m.replace(m, m.replace(key, aliasRelative));
    });
    file.contents = Buffer.from(contents)

    callback(null, file)
  })
}