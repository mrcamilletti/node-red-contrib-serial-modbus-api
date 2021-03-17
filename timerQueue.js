/*
Original code
  Author: Joseph (https://codereview.stackexchange.com/users/11919/joseph)
  Link: https://codereview.stackexchange.com/questions/148363/time-delayed-function-queue

Code modified to set a maximum number of tasks and compatible with promises.
*/

module.exports = TimerQueue;

function TimerQueue(capacity = 128){
    this.currentTimer = null;
    this.tasks = [];
    this._capacity = capacity;
  }
  
TimerQueue.prototype.addTask = function(callback, delay){
  if (this.tasks.length < this._capacity) {
    this.tasks.push({ callback: callback, delay: delay });
  } else {
    return false;
  }

  // If there's a scheduled task, bail out.
  if(this.currentTimer) return true;

  // Otherwise, start kicking tires
  this.launchNextTask();
  return true;
};

TimerQueue.prototype.launchNextTask = function(){

  // If there's a scheduled task, bail out.
  if(this.currentTimer) return;

  var self = this;
  var nextTask = self.tasks.shift();

  // There's no more tasks, clean up.
  if(!nextTask) return this.clear();

  // Otherwise, schedule the next task.
  nextTask.callback( () => {
    self.currentTimer = setTimeout(function(){
      self.currentTimer = null;
      // Call this function again to set up the next task.
      self.launchNextTask();
    }, nextTask.delay);
  });
};

TimerQueue.prototype.clear = function(){
  var self = this;

  if (self.currentTimer) clearTimeout(self.currentTimer);

  // Timer clears only destroy the timer. It doesn't null references.
  self.currentTimer = null;

  // Fast way to clear the task queue
  //this.tasks.length = 0;
};

TimerQueue.prototype.length = function() {
  var self = this;
  return self.tasks.length;
}
