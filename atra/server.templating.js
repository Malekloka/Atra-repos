const fs = require('fs');

function useTemplates(app) {
  app.engine('html', (filePath, options, callback) => { // define the template engine
    fs.readFile(filePath, (err, content) => {
      if (err) return callback(err)
      // this is an extremely simple template engine
      let rendered = content.toString()
      for(key in options){
        const keySyntax = `{{${key}}}`;
        if(rendered.indexOf(keySyntax) != -1){
          rendered = rendered.replace(keySyntax, options[key]);
          rendered = rendered.replace(keySyntax, options[key]);
          rendered = rendered.replace(keySyntax, options[key]);
          rendered = rendered.replace(keySyntax, options[key]);
        }
      }
      
      return callback(null, rendered)
    })
  })

  app.set('views', './frontend') // specify the views directory
  app.set('view engine', 'html') // register the template engine
}

module.exports = {
  useTemplates
}