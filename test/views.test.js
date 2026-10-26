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

test('overdue tasks stay visible without completion or takeover actions in either role',()=>{
  for(const role of ['Staff','Admin']) {
    const render=page(role),html=render("taskFilter='Overdue'; tasksPage()");
    assert.match(html,/GH-01/);
    assert.doesNotMatch(html,/class="task-group"|data-action="complete"|data-action="takeover"|>Pending</);
    assert.doesNotMatch(render('dashboard()'),/data-action="complete"|>View notifications</);
  }
  const render=page();
  assert.match(render("state.tasks[0].scheduled_date=state.today;taskDetails(state.tasks[0])"),/data-action="complete"/);
});

test('admin can filter all assignments and read escaped weather observations',()=>{
  const render=page('Admin');
  assert.match(render("taskFilter='Overdue'; tasksPage()"),/GH-02/);
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


test('zone filters update existing plots without rebuilding or moving the selected map',()=>{
  const render=page('Admin');
  const result=render(`state.plots=[{plot_id:1,zone:'Greenhouse',plot_code:'GH-01'},{plot_id:2,zone:'Outdoor',plot_code:'OP-01'}];
    const plots=state.plots.map(p=>({dataset:{id:String(p.plot_id)},classList:{toggle(name,value){this[name]=value}}}));
    const buttons=['All zones','Greenhouse','Outdoor'].map(zone=>({dataset:{id:zone},classList:{toggle(name,value){this[name]=value}},setAttribute(name,value){this[name]=value}}));
    document.querySelectorAll=selector=>selector==='.map-plot'?plots:buttons;
    renderMain=()=>{throw new Error('Map must not be rebuilt')};zoomMap=()=>{throw new Error('Camera must not move')};
    mapPan={x:47,y:-25};mapZoom=1.5;zone='Outdoor';filterMap();
    JSON.stringify({dimmed:plots.map(p=>p.classList.dimmed),pressed:buttons.map(b=>b['aria-pressed']),pan:mapPan,zoom:mapZoom})`);
  assert.deepEqual(JSON.parse(result),{dimmed:[true,false],pressed:['false','false','true'],pan:{x:47,y:-25},zoom:1.5});
});


test('map editing and removal controls are separate from plot details and staff views',()=>{
  const render=page('Admin');
  render("state.plots=[{plot_id:1,plot_code:'GH-01',zone:'Greenhouse',map_slot:1,occupancy_status:'Vacant',map_x:10,map_y:20,map_w:15,map_h:10},{plot_id:2,plot_code:'REMOVED',zone:'Outdoor',removed_at:'2026-10-26',map_slot:2}]");
  const normal=render('plotsPage()');
  assert.match(normal,/Edit map/);assert.doesNotMatch(normal,/plot-handle|map-edit-toolbar|REMOVED|data-action="new-plot"/);
  const edit=render('editingMap=true;mapEditId=1;plotsPage()');
  assert.match(edit,/Done editing map/);assert.match(edit,/map-edit-toolbar/);assert.match(edit,/data-action="new-plot"/);
  assert.equal((edit.match(/class="plot-handle/g)||[]).length,4);
  assert.match(edit,/x="100" y="140" width="150" height="70"/);
  assert.doesNotMatch(page('Staff')('plotsPage()'),/data-action="map-edit"|data-action="new-plot"|data-action="remove-plot"/);
});


test('plot photos use the authenticated endpoint and the picker stays in the details editor',()=>{
  const render=page('Admin');
  render("location.search='?id=2';state.plots=[{plot_id:2,plot_code:'GH-02',has_photo:true,photo_version:3}]");
  assert.match(render("plotFacts({crop_name:'Tomato'},state.plots[0])"),/src="\/api\/plot-photo\?id=2&v=3"/);
  assert.match(render("plotFacts({crop_name:'Tomato'})"),/src="\/img\/testinglang.png"/);
  const editor=render("plotEditor({description:'Growing well'})");
  assert.match(editor,/id="plot-photo-file" type="file" accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(editor,/Use default image/);assert.doesNotMatch(editor,/data-action="remove-plot"/);
});

test('photo picker rejects unsupported files and oversized originals before decoding',async()=>{
  const render=page('Admin');
  await assert.rejects(render("preparePlotPhoto({type:'image/svg+xml',size:100})"),/Choose a JPG/);
  await assert.rejects(render("preparePlotPhoto({type:'image/jpeg',size:11*1024*1024})"),/up to 10 MB/);
});
