function formValidator(formName) {
    const form = document.getElementById(formName);
    var form_data = new FormData(form);

    var missing = 0;

    var questions = document.querySelectorAll("div.question[required]");
    
    if (questions.length) {
        questions.forEach(function(question) {
            var inputs = question.querySelectorAll("input");
            if (inputs.length) {
                var input_name = inputs[0].name;
                if(!form_data.has(input_name)) {
                    missing += 1;
                }
                else {
                    var input_value = form_data.get(input_name);
                    if (input_value === "") {
                        missing += 1;
                    }
                }
            }
        })
    }

    if (missing > 0) {
        alert("Please fill all required fields marked by '*'");
        return false;
    }
    else {
        return true;
    }
}


function mergeObjectsArray(arr) {
  const out = {};
  for (const item of arr) {
    for (const [k, v] of Object.entries(item)) {
      let val = v;
      if (typeof v === 'string') {
        try { val = JSON.parse(v); } catch (e) { val = v; }
      }
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        out[k] = out[k] || {};
        for (const [subk, subv] of Object.entries(val)) {
          out[k][subk] = (out[k][subk] || []).concat(subv);
        }
      } else {
        if (!out[k]) out[k] = val;
        else if (Array.isArray(out[k]) && Array.isArray(val)) out[k] = out[k].concat(val);
        else out[k] = val;
      }
    }
  }
  return out;
}