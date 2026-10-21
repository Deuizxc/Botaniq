import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPosition, plotOverview, plotHistory, filterHistory, assignedPending, taskPeriod, calendarMonth, notificationKeys } from '../js/garden.js';

const plot={plot_id:1,plot_code:'GH-01'};
const cycle={cycle_id:1,current_plot_id:1,origin_plot_id:1,crop_name:'Tomato',planted_date:'2026-01-01',harvest_date:'2026-02-01'};
const state={
  cycles:[cycle],entries:[],
  tasks:[
    {plot_id:1,task_type:'Manual watering',status:'Completed',completed_at:'2026-01-15T01:00:00.000Z'},
    {plot_id:1,task_type:'Manual watering',status:'Completed',completed_at:'2026-03-15T01:00:00.000Z'}
  ],
  nutrients:[
    {plot_id:1,nutrient_type:'Fertilizer',product:'Compost',application_date:'2026-01-20'},
    {plot_id:1,nutrient_type:'Fertilizer',product:'New fertilizer',application_date:'2026-03-20'}
  ]
};
test('27 map positions fit their paths and do not overlap',()=>{
  const boxes=Array.from({length:27},(_,i)=>mapPosition(i+1));
  for(const [i,[x,y,w,h]] of boxes.entries()){
    assert.ok(x>=0&&y>=0&&x+w<=100&&y+h<=100);
    for(const [xx,yy,ww,hh] of boxes.slice(i+1))assert.ok(x+w<=xx||xx+ww<=x||y+h<=yy||yy+hh<=y);
  }
});
test('historical crops exclude later watering and fertilizer records',()=>{
  const past=plotHistory(state,plot).find(r=>r.key==='cycle-1');
  assert.equal(past.watered_at,'2026-01-15T01:00:00.000Z');
  assert.equal(past.fertilizer,'Compost');
  assert.equal(past.harvested_at,'2026-02-01');
  const current=plotOverview(state,plot);
  assert.equal(current.watered_at,'2026-03-15T01:00:00.000Z');
});

test('calendar and map mark only the current staff member unfinished assignments',()=>{
  const tasks=[{task_id:1,assigned_staff_id:2,status:'Pending',scheduled_date:'2026-10-15',scheduled_time:'08:00'},{task_id:2,assigned_staff_id:3,status:'Pending',scheduled_date:'2026-10-16'},{task_id:3,assigned_staff_id:2,status:'Completed',scheduled_date:'2026-10-17'}];
  const own=assignedPending(tasks,2);assert.equal(own.length,1);
  const month=calendarMonth('2026-10-22',0,own);
  assert.equal(month.cells.filter(Boolean).length,31);
  assert.equal(month.cells.find(c=>c?.day===15).count,1);
  assert.equal(month.cells.find(c=>c?.day===16).count,0);
  assert.equal(month.cells.find(c=>c?.day===17).count,0);
  assert.equal(calendarMonth('2024-01-31',1,[]).cells.filter(Boolean).length,29);
  assert.equal(calendarMonth('2026-12-01',1,[]).label,'January 2027');
  assert.equal(taskPeriod('2026-10-21','2026-10-22'),'Overdue');
  assert.equal(taskPeriod('2026-10-22','2026-10-22'),'Today');
  assert.equal(taskPeriod('2026-10-25','2026-10-22'),'This week');
  assert.equal(taskPeriod('2026-10-26','2026-10-22'),'Next week');
  assert.equal(taskPeriod('2026-11-02','2026-10-22'),'Later');
  assert.deepEqual(notificationKeys({tasks,user:{role:'Staff',user_id:2},messages:[{message_id:1}]}),['task-1-2026-10-15-08:00']);
});

test('fertilizer completion appears in current overview and permanent history',()=>{
  const nutrients=[...state.nutrients,{log_id:99,plot_id:1,nutrient_type:'Fertilizer',product:'Compost tea',application_date:'2026-04-01',applied_at:'2026-04-01T02:00:00.000Z',full_name:'Garden staff',notes:'Applied around the base.'}];
  const entries=[{plot_id:1,cycle_id:null,fertilizer:null,recorded_at:'2026-04-01T01:00:00.000Z'}];
  const data={...state,nutrients,entries};
  assert.equal(plotOverview(data,plot).fertilizer,'Compost tea');
  assert.equal(plotOverview(data,plot).fertilized_at,'2026-04-01T02:00:00.000Z');
  assert.match(plotHistory(data,plot).find(r=>r.key==='nutrient-99').description,/Compost tea.*Garden staff/);
});
test('saved None is preserved and later edits do not alter earlier snapshots',()=>{
  const entries=[
    {entry_id:2,plot_id:1,cycle_id:null,description:'New description',fertilizer:null,fertilized_at:null,recorded_at:'2026-04-01T00:00:00.000Z'},
    {entry_id:1,plot_id:1,cycle_id:null,description:'Old description',fertilizer:'Compost',fertilized_at:'2026-03-20',recorded_at:'2026-03-21T00:00:00.000Z'}
  ];
  assert.equal(plotOverview({...state,entries},plot).fertilizer,null);
  const history=plotHistory({...state,entries},plot);
  assert.equal(history.find(e=>e.entry_id===1).description,'Old description');
  assert.equal(history.find(e=>e.entry_id===1).fertilizer,'Compost');
});
test('search combines quoted crop names, fertilizer and exclusive date tokens',()=>{
  const records=[
    {crop_name:'String beans',description:'Climbing well',fertilizer:'Compost',date:'2026-02-10',type:'Harvested'},
    {crop_name:'Tomato',description:'Ready',fertilizer:null,date:'2026-02-11',type:'Saved update'}
  ];
  assert.equal(filterHistory(records,'crop:"String beans" fertilizer:compost after:2026-02-01 before:2026-03-01').length,1);
  assert.equal(filterHistory(records,'fertilizer:none')[0].crop_name,'Tomato');
  assert.equal(filterHistory(records,'before:2026-02-10').length,0);
  assert.equal(filterHistory(records,'on:2026-02-11','none','2026-02-11','2026-02-11').length,1);
  assert.equal(filterHistory(records,'on:invalid').length,0);
});

test('cleared care fields stay empty until a newer care event is recorded',()=>{
  const entries=[{plot_id:1,cycle_id:null,description:'Resting',watered_at:null,harvested_at:null,fertilizer:null,fertilized_at:null,recorded_at:'2026-04-01T00:00:00.000Z'}];
  const cleared=plotOverview({...state,entries},plot);
  assert.equal(cleared.watered_at,null);
  assert.equal(cleared.harvested_at,null);
  const tasks=[...state.tasks,{plot_id:1,task_type:'Manual watering',status:'Completed',completed_at:'2026-04-02T01:00:00.000Z'}];
  assert.equal(plotOverview({...state,entries,tasks},plot).watered_at,'2026-04-02T01:00:00.000Z');
});
