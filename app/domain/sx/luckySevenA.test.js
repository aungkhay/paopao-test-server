const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const parse = require('./parseResult');
function load(name, mocks) {
    const mod = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, name), 'utf8'), {
        module: mod, exports: mod.exports, __filename: name,
        require(id) { if (id in mocks) return mocks[id]; throw new Error(`Unexpected dependency ${id}`); },
        console: { log() {}, error() {} }, setTimeout() {}
    }, { filename: name });
    return mod.exports;
}
const parameters = { banker_odds:95, player_odds:100, tie_odds:800, pair_odds:1100, lucky_6_2_odds:1200, lucky_6_3_odds:2000, perfect_pair:2500, lucky7_4_odds: 3000, lucky7_5_odds: 4000, lucky7_6_odds: 5000 };
const emptyBet = { z:0,x:0,h:0,zd:0,xd:0,l:0,k:0,m:0,q:0,a:0, userName:'player', userId:1, Id:1 };
let rows = [], updates = [], released = 0;
const result = load('result.js', {
    '../../dao/userDao': {
        async getBetInfo() { return { data: rows }; },
        async getJcTotal() { return { data: [] }; },
        async updateResult(msg, bet) { updates.push({ msg: {...msg}, bet }); }
    },
    '../../dao/playerDao': { async getRealPlayerName() { return { data: [{playername:'player'}] }; }, async updatePointsAfterSettlement() { return {}; } },
    '../../dao/financialInquiriesDao': { async total_gameshist_day() { return {}; } },
    '../../dao/systemDao': { async getParameter() { return { data: [parameters] }; } },
    './parseResult': parse,
    pomelo: { app: { get() { return { async lock() { return { async unlock() { released++; } }; } }; } } },
    './sendToFrontEnd': { sendNoticeToGameClient() {} }
});
const betModule = load('bet.js', {
    pomelo: { app: { get() { return {}; } } },
    '../GMResponse': function () {}, '../../dao/userDao': {}, '../../dao/playerDao': {},
    '../../dao/systemDao': {}, 'pomelo-logger': { getLogger() { return {}; } },
    '../../util/gameMsg': {}, '../../util/code': { GAME: {} },
    './parseResult': parse, './sendToFrontEnd': {}, express: {}
});
async function main() {
    assert.equal(JSON.stringify(betModule.getBetReplacementKeys('幸运七A')), '["a"]');
    assert.equal(JSON.stringify(betModule.getBetCancellationKeys('幸运七A')), '["a"]');
    assert.equal(JSON.stringify(betModule.getBetCancellationKeys('幸运七')), '["q"]');
    const roomLimits = {parameter_setup:{lucky7_min_limit:10,lucky7_max_limit:1000}};
    assert.equal(await betModule.chkLimit({bet:parse.parseBetStrToArray('A1001')},roomLimits),true);
    assert.equal(await betModule.chkMinLimit({bet:parse.parseBetStrToArray('a9')},roomLimits),true);
    assert.equal(await betModule.chkLimit({bet:parse.parseBetStrToArray('A100')},roomLimits),false);

    for (const text of ['a100', 'A100', '100a', '幸运七A100']) {
        assert.deepEqual(parse.parseBetStrToArray(text), [{type:'幸运七A',amount:100}]);
    }
    assert.deepEqual(parse.parseBetStrToArray('aw1'), [{type:'幸运七A',amount:10000}]);
    assert.deepEqual(parse.parseBetStrToArray('a100q200').map(x=>x.type), ['幸运七A','幸运七']);
    assert.deepEqual(parse.parseBetStrToArray('ac').map(x=>x.type), ['撤销','幸运七A']);
    const cases = [[1|2048,5],[2|2048,5],[4|2048,5],[1|4096,15],[2|4096,15],[4|4096,15],
        [2|8192,35],[2|8192|2048,35],[2|256,0],[2|256|2048,5],[2|512|2048,5],[2|512|4096,15],[2|1024,0],[1,0],[4,0]];
    for (const [code, multiplier] of cases) {
        const expected = multiplier ? 100 * (1+multiplier) : 0;
        const summary = result.do_settlement_jc_bjl(code,parameters,{a:100});
        assert.equal(summary.t_fh,expected);
        assert.equal(summary.t_yl,100-expected);
        rows = [{...emptyBet,a:100}]; updates=[];
        const msg = {result_code:code,cc:1,jc:1,roomId:1,group_nickname:'test'};
        const room = {rType:'bjl',Id:1,group_nickname:'test'};
        await result.doResult(msg,room);
        assert.equal(updates[0].bet.t_fh,expected);
        assert.equal(updates[0].bet.t_xz,100);
        assert.equal(updates[0].bet.ayl,expected-100);
        assert.equal(updates[0].bet.sb_yl,expected-100);
        assert.equal(updates[0].bet.yxxz,100);
        updates=[];
        await result.re_doResult(msg,room,[{...emptyBet,a:100,yxxz:77}]);
        assert.equal(updates[0].bet.t_fh,expected);
        assert.equal(updates[0].bet.yxxz,77);
    }
    assert.equal(result.do_settlement_jc_bjl(2|2048,{...parameters,lucky7_a_2_odds:700},{a:100}).t_fh,800);
    assert.equal(result.do_settlement_jc_bjl(2|8192,{...parameters,lucky7_a_2_odds:700},{a:100}).t_fh,3800);
    assert.equal(result.do_settlement_jc_bjl(1|4096,{...parameters,lucky7_a_3_odds:1800},{a:100}).t_fh,1900);
    const independentLimits = {parameter_setup:{lucky7_max_limit:1000,lucky7_a_max_limit:2000,lucky7_a_min_limit:50}};
    assert.equal(await betModule.chkLimit({bet:parse.parseBetStrToArray('a1500')},independentLimits),false);
    assert.equal(await betModule.chkMinLimit({bet:parse.parseBetStrToArray('a40')},independentLimits),true);
    independentLimits.parameter_setup.enable_Lucky_7_a = 0;
    assert.equal(await betModule.chkLimit({bet:parse.parseBetStrToArray('a100')},independentLimits),true);
    for (const [code, field, value, expected] of [
        [2|8192,'lucky7_a_super_4_odds',3500,4100],
        [2|8192,'lucky7_a_super_4_odds',0,600]
    ]) {
        parameters[field] = value;
        assert.equal(result.do_settlement_jc_bjl(code,parameters,{a:100}).t_fh,expected);
        rows=[{...emptyBet,a:100}]; updates=[];
        await result.doResult({result_code:code},{rType:'bjl'});
        assert.equal(updates[0].bet.t_fh,expected);
        delete parameters[field];
    }
    const mixed = result.do_settlement_jc_bjl(2|256|8192,parameters,{a:100,q:100});
    assert.equal(mixed.t_fh,3600+3100);
    assert.equal(mixed.t_yl,-6500);
    assert.equal(result.do_settlement_jc_bjl(2|1024,parameters,{q:100}).t_fh,5100);
    // Existing Q results still accept the original five-card code without A metadata.
    assert.equal(result.do_settlement_jc_bjl(2|512,parameters,{q:100}).t_fh,4100);
    assert.equal(result.do_settlement_jc_bjl(2|512,parameters,{a:100}).t_fh,0);
    assert.equal(result.do_settlement_jc_bjl(2|8192,parameters,{q:100}).t_fh,0);
    assert.ok(parse.parseResult(2|8192).includes('超级幸运七'));
    assert.throws(()=>parse.luckySevenAMultiplier(2048|4096),/不能同时/);
    rows = [{...emptyBet,a:100}]; updates=[];
    await assert.rejects(result.doResult({result_code:2|8192|4096},{rType:'bjl'}),/不能同时/);
    assert.equal(updates.length,0);
    assert.equal(released,cases.length*2+3);
    console.log('Lucky seven A: parser, independent Q, payouts, player settlement, re-settlement and invalid result tests passed.');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
