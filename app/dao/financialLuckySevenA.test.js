const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let empty = false;
const mysql = {
    buildSummarySQL(table, fields, condition) {
        assert.ok(fields.includes('a'));
        assert.ok(fields.includes('a_yl'));
        return `SELECT COUNT(*) AS total_count, ${fields.map(f=>`SUM(${f}) AS total_${f}`).join(',')} FROM ${table} WHERE ${condition}`;
    },
    async query(db,sql,args) {
        assert.equal((sql.match(/\?/g)||[]).length,args.length);
        if (/AS total_a\b/i.test(sql)) {
            assert.match(sql,/AS total_a_yl\b/i);
            return [{total_count:empty?0:2,total_k:empty?null:'450',total_k_yl:empty?null:'-450',total_a:empty?null:'300',total_a_yl:empty?null:'3400'}];
        }
        if (/COUNT\(\*\)/i.test(sql)) return [{total:empty?0:2}];
        if (/SUM\(a\)/i.test(sql)) assert.match(sql,/SUM\(a_yl\) AS a_yl/i);
        return empty ? [] : [{a:'100',a_yl:'3500',q:20},{a:'200',a_yl:'-100',q:0}];
    }
};
const mod={exports:{}};
vm.runInNewContext(fs.readFileSync(__dirname+'/financialInquiriesDao.js','utf8'),{
    module:mod,exports:mod.exports,console,
    require(id) {
        if(id==='pomelo') return {app:{get(){return mysql;}}};
        if(id==='../util/utils') return {toDateYMD:x=>x};
        if(id==='./settledRecordsSql') return '';
        throw new Error(id);
    }
});
(async()=>{
    for(const name of ['getJcStatistics','htSbDetailsQuery']) {
        empty=false;
        const response=await mod.exports[name]({group_nickname:'test',date:'2026-10-19',startTime:'2026-10-19',currentPage:1,pageSize:20});
        assert.equal(response.err,null);
        const data=response.data;
        assert.equal(data.list[0].lucky7_a,100);
        assert.equal(data.list[0].lucky7_a_yl,3500);
        assert.equal(data.list[1].lucky7_a_yl,-100);
        assert.equal(data.list[0].q,20);
        assert.equal(data.summary.total_lucky7_a,300);
        assert.equal(data.summary.total_lucky7_a_yl,3400);
        assert.equal(data.summary.total_a_yl,3400);
        assert.equal(data.summary.total_k,450);
        if (name === "htSbDetailsQuery") assert.equal(data.summary.total_k_yl,-450);
        empty=true;
        const zero=(await mod.exports[name]({currentPage:1,pageSize:20})).data;
        assert.equal(zero.list.length,0);
        assert.equal(zero.summary.total_k,0);
        assert.equal(zero.summary.total_lucky7_a,0);
        assert.equal(zero.summary.total_lucky7_a_yl,0);
    }
    console.log('Financial lucky7_a detail and summary tests passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
