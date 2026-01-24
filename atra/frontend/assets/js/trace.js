const trace = (msg) => {
  console.log("info: " + msg);
  if(Sentry){
    // breadcrumb
    Sentry.addBreadcrumb({
      category: 'trace',
      message: msg,
      level: 'info',
    });
  }
}

const traceError = (msg) => {
  console.error(msg);
  if(Sentry){
    Sentry.captureMessage(msg, 'error');
  }
}

if (Sentry) {
  Sentry.init({
    release: "dream-catcher@0.0.1",
  });
}  