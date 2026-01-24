class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
  }

  emit(eventName, data) {
    const event = this.events[eventName];
    if (event) {
      event.forEach(cb => cb(data));
    }
  }

  bubble(eventName, eventEmitter) {
    eventEmitter.on(eventName, (data) => {
      this.emit(eventName, data);
    });
  }
}

export default EventEmitter;