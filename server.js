// api/server.js (Vercel Serverless Function用)
// ※実際は Vercel の仕様上 api/index.js または api/game.js に配置します
const crypto = require('crypto');

// 4. クイズデータのデータストア化（拡張性の確保）
const QUIZ_BANK = [
    { id: 1, question: "植物が光合成を行う際、主に吸収する気体は何？", options: ["酸素", "二酸化炭素", "窒素", "水素"], correct: 1 },
    { id: 2, question: "水の沸点は通常何度？", options: ["0度", "50度", "100度", "120度"], correct: 2 },
    { id: 3, question: "地球の最も外側を覆っている岩石の層を何という？", options: ["地殻", "マントル", "外核", "内核"], correct: 0 }
];

// チート対策のためのサーバー側状態管理（簡易インメモリ/本番はRedis推奨）
// Vercel Serverlessはインスタンスが揮発するため、セッションやトークン検証を暗号化
const SECRET_KEY = process.env.GAME_SECRET_KEY || "fallback-super-secret-key-12345";

module.exports = async (req, res) => {
    // CORSヘッダーの設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { pathname } = new URL(req.url, `http://${req.headers.host}`);

    try {
        // --- API 1: クイズの取得 (正解データは隠蔽) ---
        if (req.method === 'GET' && pathname.endsWith('/api/quiz')) {
            const clientQuizzes = QUIZ_BANK.map(q => ({
                id: q.id,
                question: q.question,
                options: q.options
            }));
            return res.status(200).json({ success: true, quizzes: clientQuizzes });
        }

        // --- API 2: 解答送信・判定・スコア計算（チート対策） ---
        if (req.method === 'POST' && pathname.endsWith('/api/answer')) {
            const { quizId, selectedOption, userToken, baseHp } = req.body;

            // クイズ検証
            const quiz = QUIZ_BANK.find(q => q.id === quizId);
            if (!quiz) return res.status(400).json({ error: "無効なクイズIDです" });

            const isCorrect = quiz.correct === parseInt(selectedOption);
            
            // 1. セキュリティ・チート対策：ダメージ・コイン計算はすべてサーバーで行う
            let damageDealt = 0;
            let coinsEarned = 0;
            
            if (isCorrect) {
                damageDealt = Math.floor(Math.random() * 20) + 15; // 15〜34ダメージ
                coinsEarned = 10;
            } else {
                damageDealt = 0;
                coinsEarned = 0;
            }

            // サーバー側で改ざん不可能なセッションハッシュ（検証用）を作成
            const hash = crypto.createHmac('sha256', SECRET_KEY)
                               .update(`${userToken}-${coinsEarned}-${damageDealt}`)
                               .digest('hex');

            return res.status(200).json({
                success: true,
                isCorrect,
                damageDealt,
                coinsEarned,
                verificationHash: hash
            });
        }

        return res.status(404).json({ error: "エンドポイントが見つかりません" });
    } catch (error) {
        return res.status(500).json({ error: "サーバー内部エラーが発生しました" });
    }
};
