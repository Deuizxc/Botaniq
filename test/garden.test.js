import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPosition, plotOverview, plotHistory, filterHistory } from '../js/garden.js';

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
  const [past]=plotHistory(state,plot);
  assert.equal(past.watered_at,'2026-01-15T01:00:00.000Z');
  assert.equal(past.fertilizer,'Compost');
  assert.equal(past.harvested_at,'2026-02-01');
  const current=plotOverview(state,plot);
  assert.equal(current.watered_at,'2026-03-15T01:00:00.000Z');
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
