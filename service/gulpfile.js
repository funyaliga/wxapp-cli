const gulp = require('gulp');
const { series, task, watch, parallel } = require('gulp');
const del = require('del');
const fs = require('fs');
const path = require('path');
const exec = require('shelljs').exec;
const gulpif = require('gulp-if');
const babel = require('gulp-babel');
const sass = require('gulp-sass')(require('sass'));
const postcss = require('gulp-postcss');
const postcssPx2rpx = require('postcss-px2rpx');
const postcssFontbase64 = require('postcss-font-base64');
const cached = require('gulp-cached');
const uglifyes = require('uglify-es');
const composer = require('gulp-uglify/composer');
const sourcemaps = require('gulp-sourcemaps');
const chalk = require('chalk');
const rename = require('gulp-rename');
const yaml = require('js-yaml')
const alias = require('./gulp-alias');

const ENV = process.env.NODE_ENV || 'development';
const isBuild = process.env.GULP_TASK === 'build';

const buildPath = './build'

const paths = {
  sass: './src/**/*.scss',
  script: ['./src/**/*.js'],
  static: [
    'src/**/*.json',
    'src/**/*.wxml',
    'src/**/*.wxs',
    'src/**/*.wxss',
    'src/**/*.{png,jpg,gif,svg}',
    'src/**/font/**/*.{eot,svg,ttf,woff,woff2}',
  ],
  clean: [
    `${buildPath}/**`,
    `!${buildPath}`,
    `!${buildPath}/node_modules`,
    `!${buildPath}/miniprogram_npm`,
    `!${buildPath}/package-lock.json`,
  ],
  projectConfig: `${buildPath}/project.config.json`,
  config: `service/config.yaml`,
};


// 文件夹判空
function isDirEmpty(dirname) {
  return fs.promises.readdir(dirname).then(files => {
    return files.length === 0;
  });
}

gulp.task('module:install', cb => {
  const sourcePath = './package.json';
  const destPath = buildPath + '/package.json';
  if (!fs.existsSync(buildPath)) {
    fs.mkdirSync(buildPath);
  }

  const sourcePkg = require(path.resolve(sourcePath));

  try {
    // 判断是否有 package.json 的变动
    if (fs.existsSync(path.resolve(destPath))) {
      const destPkg = require(path.resolve(destPath));
      if(
        destPkg && JSON.stringify(sourcePkg.dependencies) === JSON.stringify(destPkg.dependencies) 
        && fs.existsSync(buildPath + '/node_modules') && !isDirEmpty(buildPath + '/node_modules')
      ) {
        cb();
        return;
      }
    }

    // copy文件
    fs.copyFileSync(path.resolve(sourcePath), path.resolve(destPath));

    // 安装dependencies里的包
    exec(
      `cd ${buildPath} && npm install --production`,
      (err, stdout, stderr) => {
        if (err) {
          console.log('npm install failed: ', err);
          process.exit(1);
        }
        cb();
      },
    );
  } catch (error) {
    console.log('error', error);
  }
});

gulp.task('compile:js', cb => {
  const minify = composer(uglifyes, console);
  return gulp.src(paths.script)
    .pipe(gulpif(!isBuild, cached('script')))
    .pipe(babel({
      plugins: [
        '@babel/plugin-proposal-optional-chaining',
        '@babel/plugin-proposal-nullish-coalescing-operator',
      ],
    }))
    .pipe(gulpif(!isBuild, sourcemaps.init()))
    .pipe(gulpif(isBuild, minify()))
    .pipe(gulp.dest(buildPath));
});

gulp.task('compile:sass', cb => {
  return gulp
    .src([paths.sass])
    .pipe(gulpif(!isBuild, cached('sass')))
    .pipe(
      alias({
        '~font': 'src/assets/font',
        '~scss': 'src/assets/scss',
      })
    )
    .pipe(
      sass({ errLogToConsole: true, outputStyle: 'expanded' }).on(
        'error',
        sass.logError
      )
    )
    .pipe(postcss([postcssPx2rpx({ times: 1 }), postcssFontbase64()]))
    .pipe(
      rename({
        extname: '.wxss',
      })
    )
    .pipe(gulp.dest(buildPath));
});

gulp.task('copy:static', () => {
  return gulp
    .src(paths.static)
    .pipe(cached('static'))
    .pipe(gulp.dest(buildPath));
});

gulp.task('watch:js', () => {
  gulp.watch(paths.script, gulp.parallel('compile:js'));
});

gulp.task('watch:sass', () => {
  gulp.watch(paths.sass, gulp.parallel('compile:sass'));
});

gulp.task('watch:static', () => {
  gulp.watch(paths.static, gulp.series('copy:static'));
});

gulp.task('config', (cb) => {
  const yamlData = fs.readFileSync(path.resolve(paths.config), 'utf8');
  const yamlJson = yaml.load(yamlData);
  const config = Object.keys(yamlJson).reduce((o, k) => {
    if(typeof yamlJson[k] === 'object') {
      o = Object.assign({}, o, yamlJson[k]);
    } else {
      o[k] = yamlJson[k];
    }
    return o
  }, {});

  // 更改project.config.json文件的appid
  if (fs.existsSync(paths.projectConfig)) {
    const projectConfig = JSON.parse(fs.readFileSync(paths.projectConfig) || {}, 'utf8');
    projectConfig.appid = config.APP_ID;
    fs.writeFileSync(paths.projectConfig, JSON.stringify(projectConfig, null, 2), {
      flag: 'w+',
    });
  }

  // config文件
  const content = `const config = ${JSON.stringify(config)}; export default config; `;
  fs.writeFileSync(`${buildPath}/config.js`, content, {
    flag: 'w+',
  });
  cb();
});

// 清空 dist
gulp.task('clear:dist', () => {
  return del(paths.clean);
});

const logRender = (cb) => {
  const txt1 = 'completed';
  const boxlen = `${ENV} ${txt1}`.length + 3 + 3 + 1;
  console.log(`${chalk.green(`╭${Array(boxlen).join('-')}╮`)}
${chalk.green(`│${Array(boxlen).join(' ')}│`)}
${chalk.green('│   ')}${chalk.blue(ENV)} ${txt1}${chalk.green('   │')}
${chalk.green(`│${Array(boxlen).join(' ')}│`)}
${chalk.green(`╰${Array(boxlen).join('-')}╯`)}`);
  cb();
}

// series 按顺序依次执行
// parallel 并行运行

// build
exports.build = gulp.series(
  'clear:dist',
  'module:install',
  gulp.series(
    'compile:js',
    'compile:sass',
    'copy:static',
    'config',
  ),
  logRender
);

// watch
exports.default = exports.watch = gulp.series(
  'module:install',
  gulp.series(
    'compile:js',
    'compile:sass',
    'copy:static',
    'config',
  ),
  gulp.parallel('watch:js', 'watch:sass', 'watch:static', logRender),
);

exports.clear = gulp.series('clear:dist');