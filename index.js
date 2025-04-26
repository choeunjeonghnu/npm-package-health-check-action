const core = require('@actions/core');
const fs = require('fs');
const fetch = require('node-fetch');

// package.json 읽기
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// dependencies와 devDependencies 합치기
const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
};

const packageList = Object.keys(dependencies);

if (packageList.length === 0) {
    core.info("분석할 npm 패키지가 없습니다.");
    process.exit(0);
}

async function checkNpmDownloads(packageName) {
    const url = `https://api.npmjs.org/downloads/point/last-week/${packageName}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            core.warning(`❌ "${packageName}" 조회 실패 또는 존재하지 않는 패키지입니다.`);
            return;
        }
        const data = await response.json();
        const downloads = data.downloads;

        if (downloads >= 100000) {
            core.info(`🌟 "${packageName}": 주간 ${downloads.toLocaleString()}회 다운로드 (매우 인기)`);
        } else if (downloads >= 10000) {
            core.info(`✅ "${packageName}": 주간 ${downloads.toLocaleString()}회 다운로드 (널리 사용됨)`);
        } else if (downloads >= 1000) {
            core.info(`✔️ "${packageName}": 주간 ${downloads.toLocaleString()}회 다운로드 (일반적 사용량)`);
        } else {
            core.warning(`⚠️ "${packageName}": 주간 ${downloads.toLocaleString()}회 다운로드 (사용량 적음 - 주의)`);
        }
    } catch (error) {
        core.setFailed(`에러 발생: ${error.message}`);
    }
}

// 비동기 실행
(async () => {
    for (const pkg of packageList) {
        await checkNpmDownloads(pkg);
    }
})();
