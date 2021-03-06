module.exports = TaskQueue;

function TaskQueue(capacity=256, interval=0) {
    this.interval = interval;
    this.capacity = capacity;
    this.running = 0;
    this.queue = [];
}

TaskQueue.prototype.pushTask = function(task, err) {
    var self = this;

    if (self.queue.length < self.capacity) {
        self.queue.push(task);
        if ( self.queue.length-1==0 ) {
            setTimeout( () => self.next(), self.interval);
        }
    } else {
        err();
    }
}

TaskQueue.prototype.next = function() {
    var self = this;

    if(self.queue.length) {
        var task = self.queue.shift();
        task(function(err) {            
            setTimeout( () => self.next(), self.interval);
        });
    }
}

TaskQueue.prototype.length = function() {
    var self = this;

    return self.queue.length;
}
