const ENV = process.env.NODE_ENV || 'development';
const GULP_TASK = process.env.GULP_TASK || 'default';
const shell = require('shelljs');

const build = async () => {
  try {
    if (ENV === 'production') {
      await shell.exec('git checkout master');
      await shell.exec('git pull');
    }
    await shell.exec(`cross-env NODE_ENV=${ENV} GULP_TASK=${GULP_TASK} gulp ${GULP_TASK} --gulpfile ./service/gulpfile.js --cwd . --color`);
  } catch (error) {
    console.log('error:', error);
  }
};

build();
