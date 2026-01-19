const githubActionTemplate = ({ platform }) => {
  const isIos = platform === 'ios' || platform === 'both';
  const runsOn = isIos ? 'macos-latest' : 'ubuntu-latest';

  let steps = `
      - uses: actions/checkout@v3

      - uses: actions/setup-java@v3
        with:
          distribution: 'zulu'
          java-version: '17'

      - uses: subosito/flutter-action@v2
        with:
          channel: 'stable'

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Dependencies
        run: npm install

      # IMPORTANT: Ensure your secret key files (keystore, service account json, api key p8)
      # are present in the paths defined in appship.config.json.
      # You can use secrets to write them to files here.
      # Example:
      # - name: Write Google Play Key
      #   run: echo "\${{ secrets.GOOGLE_PLAY_KEY }}" > android/service_account.json
  `;

  if (platform === 'android' || platform === 'both') {
    steps += `
      - name: Build Android
        run: npx appship build --platform android --format aab --bump none

      - name: Deploy Android
        run: npx appship deploy --platform android --target internal --artifact latest
    `;
  }

  if (platform === 'ios' || platform === 'both') {
    steps += `
      - name: Build iOS
        run: npx appship build --platform ios --bump none

      - name: Deploy iOS
        run: npx appship deploy --platform ios --target testflight --artifact latest
    `;
  }

  return `name: AppShip CI/CD

on:
  push:
    branches: [ "main" ]
  workflow_dispatch:

jobs:
  build-deploy:
    runs-on: ${runsOn}
    steps:${steps}
`;
};

const gitlabCiTemplate = ({ platform }) => {
  const isIos = platform === 'ios' || platform === 'both';
  const image = isIos ? 'macos-latest' : 'ubuntu-latest'; // GitLab SaaS runners tag, usually

  // GitLab CI is diverse. I'll stick to a generic structure assuming docker or shell runner.
  // Using a docker image with flutter for android.

  // Actually, providing a simple template is better.

  let content = `image: ghcr.io/cirruslabs/flutter:stable

stages:
  - build
  - deploy

variables:
  NODE_VERSION: '18'

before_script:
  - flutter doctor
  - npm install

# IMPORTANT: Ensure your secret key files are present.
# You can use File type CI/CD variables to inject them.
`;

  if (platform === 'android' || platform === 'both') {
    content += `
build_android:
  stage: build
  script:
    - npx appship build --platform android --format aab --bump none
  artifacts:
    paths:
      - appship-output/

deploy_android:
  stage: deploy
  script:
    - npx appship deploy --platform android --target internal --artifact latest
  dependencies:
    - build_android
`;
  }

  if (platform === 'ios' || platform === 'both') {
    content += `
# Note: iOS build requires macOS runner.
# You might need to add 'tags: [ saas-macos-medium-m1 ]' or similar if using GitLab SaaS.

build_ios:
  stage: build
  tags:
    - macos
  script:
    - npx appship build --platform ios --bump none
  artifacts:
    paths:
      - appship-output/

deploy_ios:
  stage: deploy
  tags:
    - macos
  script:
    - npx appship deploy --platform ios --target testflight --artifact latest
  dependencies:
    - build_ios
`;
  }

  return content;
};

module.exports = {
  githubActionTemplate,
  gitlabCiTemplate,
};
