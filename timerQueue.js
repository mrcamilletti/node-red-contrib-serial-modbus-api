/*
Original code
  Author: Joseph (https://codereview.stackexchange.com/users/11919/joseph)
  Link: https://codereview.stackexchange.com/questions/148363/time-delayed-function-queue

Code modified to set a maximum number of tasks and compatible with promises.
*/

module.exports = TimerQueue;

function TimerQueue(capacity = 128){
    this.running = false;
    this.currentTimer = null;
    this.tasks = [];
    this._capacity = capacity;
    this.debug_mode = false;
  }
  
TimerQueue.prototype.addTask = function(callback, delay){
  var self = this;

  if (self.tasks.length < self._capacity) {
    self.tasks.push({ callback: callback, delay: delay });
  } else {
    return false;
  }

  // If there's a scheduled task, bail out.
  if(self.running == true) return true;

  // Otherwise, start kicking tires
  self.running = true;
  self.launchNextTask();
  return true;
};

TimerQueue.prototype.launchNextTask = function(){

  // If there's a scheduled task, bail out.
  //if(this.running == true) return;
  

  var self = this;
  var nextTask = self.tasks.shift();

  // There's no more tasks, clean up.
  if(!nextTask) {
    self.running = false;
    return false;
  }  


  // Otherwise, schedule the next task.
  nextTask.callback( () => {
    if (self.debug_mode) console.log("Task launched");
    self.currentTimer = setTimeout(function(){
      // Call this function again to set up the next task.
      if (self.debug_mode) console.log("Next task ...");
      self.launchNextTask();      
    }, nextTask.delay);
  });
};

TimerQueue.prototype.clear = function(){
  var self = this;

  if (self.running) { 
    clearTimeout(self.currentTimer);
    // Timer clears only destroy the timer. It doesn't null references.
    self.running = false;
  }
  
  // Fast way to clear the task queue
  //this.tasks.length = 0;
  self.tasks.splice(0,self.tasks.length);
};

TimerQueue.prototype.length = function() {
  var self = this;
  return self.tasks.length;
}
