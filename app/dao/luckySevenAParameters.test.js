const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let existing = [], writes = [];
const sqlHelper = { async query(db, sql, args) {
    if (/^select/i.test(sql.trim())) return existing;
    assert.equal((sql.match(/\?/g)||[]).length,args.length);
    if (/INSERT/.test(sql)) {
        const columns = sql.match(/group_parameter_setup\s*\(([^)]+)\)/)[1].split(',').map(s=>s.trim());
        assert.equal(columns.length,args.length);
        writes.push(Object.fromEntries(columns.map((key,i)=>[key,args[i]])));
    } else {
        const columns = [...sql.matchAll(/(\w+)\s*=\s*\?/g)].map(m=>m[1]);
        writes.push(Object.fromEntries(columns.map((key,i)=>[key,args[i]])));
    }
    return {affectedRows:1};
} };
const mod = {exports:{}};
vm.runInNewContext(fs.readFileSync(__dirname+'/systemDao.js','utf8'),{
    module:mod,exports:mod.exports,console:{error(){}},
    require(id) {
        if(id==='pomelo') return {app:{get(key){return key==='sqlHelper'?sqlHelper:{};}}};
        if(id==='./Cache') return {};
        throw new Error(id);
    }
});
const dao = mod.exports;
(async()=>{
    assert.equal((await dao.parameterSetup({group_nickname:'test'})).err,null);
    assert.equal(writes[0].lucky7_a_2_odds,500);
    assert.equal(writes[0].lucky7_a_3_odds,1500);
    assert.equal(writes[0].lucky7_a_super_4_odds,3000);
    existing=[{lucky7_a_super_4_odds:3200,enable_Lucky_7_a:0,lucky7_a_2_odds:600,lucky7_a_3_odds:1600,lucky7_a_min_limit:20,lucky7_a_max_limit:2000}];
    assert.equal((await dao.parameterSetup({group_nickname:'test'})).err,null);
    assert.equal(writes[1].enable_Lucky_7_a,0);
    assert.equal(writes[1].lucky7_a_super_4_odds,3200);
    assert.equal(writes[1].lucky7_a_2_odds,600);
    assert.equal((await dao.parameterSetup({group_nickname:'test',lucky7_a_super_4_odds:'3500',lucky7_a_2_odds:'700',enable_Lucky_7_a:'1'})).err,null);
    assert.equal(writes[2].lucky7_a_2_odds,700);
    assert.equal(writes[2].enable_Lucky_7_a,1);
    assert.equal(writes[2].lucky7_a_super_4_odds,3500);
    assert.equal((await dao.getParameter({group_nickname:'test'})).data[0].lucky7_a_3_odds,1600);
    for(const fields of [{lucky7_a_super_4_odds:-1},{enable_Lucky_7_a:2},{lucky7_a_2_odds:'bad'},{lucky7_a_3_odds:-1},{lucky7_a_min_limit:3000}]) {
        assert.ok((await dao.parameterSetup({group_nickname:'test',...fields})).err);
    }
    assert.equal(writes.length,3);
    console.log('Lucky A parameters: insert/update SQL, defaults, preservation, reads and validation passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
