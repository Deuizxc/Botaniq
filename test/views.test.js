import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import * as garden from '../js/garden.js';

// Exercise the actual page renderers without starting authentication or polling.
const source=readFileSync(new URL('../js/script.js',import.meta.url),'utf8').replace(/^import [^\n]*\n/,'').split('const landingRoute=')[0];
function page(role='Staff') {
  const context=createContext({...garden,URLSearchParams,location:{search:''},window:{addEventListener(){}},document:{addEventListener(){}}});
  runInContext(source,context);
  const state={today:'2026-10-23',user:{user_id:2,role,full_name:'Garden Staff'},users:[{user_id:2,role:'Staff',full_name:'Garden Staff',active:1},{user_id:3,role:'Staff',full_name:'Other Staff',active:1}],plots:[],cycles:[],adjustments:[],plants:[{plant_id:1,crop_name:'Tomato',variety:'Cherry'},{plant_id:2,crop_name:'Tomato',variety:'Beefsteak'}],tasks:[
    {task_id:1,plot_id:1,plot_code:'GH-01',zone:'Greenhouse',task_type:'Manual watering',assigned_staff_id:2,assigned_staff:'Garden Staff',status:'Pending',scheduled_date:'2026-10-22',scheduled_time:'08:00'},
    {task_id:2,plot_id:2,plot_code:'GH-02',zone:'Greenhouse',task_type:'Manual watering',assigned_staff_id:3,assigned_staff:'Other Staff',status:'Pending',scheduled_date:'2026-10-22',scheduled_time:'08:00'}
  ]};
  context.fixture=state;runInContext('state=fixture',context);
  return code=>runInContext(code,context);
}

test('missing tasks stay visible without completion or takeover actions in either role',()=>{
  for(const role of ['Staff','Admin']) {
    const render=page(role),html=render("taskFilter='Missing'; tasksPage()");
    assert.match(html,/GH-01/);
    assert.doesNotMatch(html,/class="task-group"|data-action="complete"|data-action="takeover"|>Pending</);
    assert.doesNotMatch(render('dashboard()'),/data-action="complete"|>View notifications</);
  }
  const render=page();
  assert.match(render("state.tasks[0].scheduled_date=state.today;taskDetails(state.tasks[0])"),/data-action="complete"/);
});

test('admin can filter all assignments and read escaped weather observations',()=>{
  const render=page('Admin');
  assert.match(render("taskFilter='Missing'; tasksPage()"),/GH-02/);
  const filtered=render("staffFilter='2'; tasksPage()");
  assert.match(filtered,/GH-01/);assert.doesNotMatch(filtered,/GH-02/);
  const detail=render("state.adjustments=[{task_id:1,action:'Skip',full_name:'Garden Staff',reason:'Rain <today>',previous_schedule:'2026-10-22 08:00'}];taskDetails(state.tasks[0])");
  assert.match(detail,/Rain &lt;today&gt;/);assert.doesNotMatch(detail,/data-action="complete"|data-action="adjust"/);
});

test('crop search matches varieties and clearing it restores the full catalog for both roles',()=>{
  for(const role of ['Staff','Admin']) {
    const render=page(role);
    const result=render("cropSearch='CHERRY'; inventoryPage()").split('id="crop-results"')[1];
    assert.match(result,/Cherry/);assert.doesNotMatch(result,/Beefsteak/);
    assert.match(render("cropSearch=''; inventoryPage()").split('id="crop-results"')[1],/Beefsteak/);
    assert.match(render("cropSearch='unknown'; inventoryPage()"),/No crops match/);
  }
});
