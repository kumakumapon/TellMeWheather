const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const forecast=require('./fixtures/forecast');
function app(){
  const context=vm.createContext({console,Date,document:{addEventListener(){}},module:{exports:{}}});
  for(const file of ['components/utils.js','components/weather.js','components/laundry.js','components/clothes.js','components/hourly.js','components/heatstroke.js','components/settings.js','app.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
  return context;
}
test('overview includes child-specific clothing, gear, timestamp and native details',()=>{
  const c=app(), data=forecast();
  const settings=c.normalizeSettings({kids:[{name:'太郎',grade:'小3',sensitivity:'cold'},{name:'花子',grade:'小5',sensitivity:'hot'}],wearsUniform:true,commuteMode:'bike'});
  data.daily.precipitation_probability_max[1]=60;
  const html=c.renderQuickSummary(data,settings,'共有',false,14,{morning:14,afternoon:23},Date.now(),true);
  for(const text of ['太郎','花子','制服','レインウェア','タオル','キャッシュ','今日比','部屋干し推奨'])assert.ok(html.includes(text),text);
  assert.match(c.renderDashboardDetail('週間予報','<p>予報</p>'),/<details class="dashboard-detail"><summary>/);
});
test('strong wind and pollen suppress the compact outdoor window',()=>{
  const c=app(), data=forecast(), settings=c.normalizeSettings({considerPollen:true});
  assert.ok(!c.renderQuickSummary(data,settings,'',false,16,null,Date.now(),false).includes('雨の少ない時間'));
  settings.considerPollen=false;data.daily.wind_speed_10m_max[1]=35;
  assert.ok(!c.renderQuickSummary(data,settings,'',false,16,null,Date.now(),false).includes('雨の少ない時間'));
});
test('severe heat remains visible in the overview with details closed',()=>{
  const c=app(), data=forecast(), settings=c.normalizeSettings({});
  data.hourly.temperature_2m.fill(36);data.hourly.relative_humidity_2m.fill(80);
  assert.match(c.renderQuickSummary(data,settings,'',true,36,{morning:36,afternoon:36},Date.now(),false),/熱中症：危険/);
});
test('daily-only forecast still renders and missing rain is unknown',()=>{
  const c=app(), data=forecast(), settings=c.normalizeSettings({});data.hourly=null;
  const html=c.renderQuickSummary(data,settings,'',false,23,null,Date.now(),false);
  assert.match(html,/不明/);assert.ok(!html.includes('NaN'));
});
