const core = require('@actions/core');
const fs = require('fs');
const fetch = require('node-fetch');

// 📂 package.json 읽기
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
const packageList = Object.keys(dependencies);

if (packageList.length === 0) {
    core.info("분석할 npm 패키지가 없습니다.");
    process.exit(0);
}

// 📊 다운로드 수 체크 함수
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

        await checkMaintenanceStatus(packageName);  // 유지보수 상태 확인 호출
    } catch (error) {
        core.setFailed(`에러 발생: ${error.message}`);
    }
}

// 🔧 GitHub 저장소 경로 정규화 함수
function extractGitHubRepoPath(repoInfo) {
    if (!repoInfo || !repoInfo.url) return null;

    let url = repoInfo.url;
    url = url.replace(/^git\+/, '').replace(/\.git$/, '');

    const githubIndex = url.indexOf('github.com/');
    if (githubIndex === -1) return null;

    return url.substring(githubIndex + 'github.com/'.length);
}

// 🛠️ 유지보수 상태 확인 함수
async function checkMaintenanceStatus(packageName) {
    try {
        const res = await fetch(`https://registry.npmjs.org/${packageName}`);
        if (!res.ok) {
            core.warning(`⚠️ "${packageName}": 메타데이터 조회 실패`);
            return;
        }
        const metadata = await res.json();
        const repoPath = extractGitHubRepoPath(metadata.repository);

        if (!repoPath) {
            core.warning(`❌ "${packageName}": GitHub 저장소 정보 없음 (유지보수 상태 확인 불가)`);
            return;
        }

        const apiUrl = `https://api.github.com/repos/${repoPath}`;
        const githubRes = await fetch(apiUrl);
        if (!githubRes.ok) {
            core.warning(`⚠️ "${packageName}": GitHub API 조회 실패`);
            return;
        }

        const repoData = await githubRes.json();
        const lastPushed = new Date(repoData.pushed_at);
        const openIssues = repoData.open_issues_count;
        const stars = repoData.stargazers_count;

        const now = new Date();
        const monthsDiff = (now.getFullYear() - lastPushed.getFullYear()) * 12 + (now.getMonth() - lastPushed.getMonth());

        if (monthsDiff > 12) {
            core.warning(`⚠️ "${packageName}": 최근 커밋이 ${monthsDiff}개월 전 (유지보수 미흡)`);
        } else {
            core.info(`✅ "${packageName}": 최근 커밋 ${monthsDiff}개월 전, ⭐ ${stars} stars, 🔓 오픈 이슈 ${openIssues}개`);
        }

    } catch (err) {
        core.warning(`에러 발생: ${err.message}`);
    }
}

// 🚀 메인 실행
(async () => {
    for (const pkg of packageList) {
        await checkNpmDownloads(pkg);
    }
})();
