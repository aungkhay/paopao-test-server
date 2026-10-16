// Bound the whole operation, including preparation, and cancel in-flight HTTP requests.
module.exports = async function withSendDeadline(work, timeoutMs) {
    const controller = new AbortController();
    const deadline = Date.now() + timeoutMs;
    const error = new Error('截止图片发送超时，结果未确认，请查看群内图片后重试');
    error.code = 'SEND_TIMEOUT';
    const requestOptions = {
        signal: controller.signal,
        check() {
            if (controller.signal.aborted || Date.now() >= deadline) throw error;
        },
        remaining() {
            this.check();
            return Math.max(1, deadline - Date.now());
        }
    };
    let timer;
    try {
        return await Promise.race([
            new Promise((resolve, reject) => {
                timer = setTimeout(() => {
                    controller.abort();
                    reject(error);
                }, timeoutMs);
            }),
            Promise.resolve().then(() => work(requestOptions))
        ]);
    } finally {
        clearTimeout(timer);
        controller.abort();
    }
};
