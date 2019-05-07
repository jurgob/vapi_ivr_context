// function getIvROptions(){
//   return {
//     root:{
//       ncco: [
//         {
//             "action": "talk",
//             "text": "Welcome to our nexmo iterative questionary",
//             "voiceName": "Amy",
//             "bargeIn": false
//         },
//         {
//             "action": "talk",
//             "text": "What's your favourite food?",
//             "voiceName": "Amy",
//             "bargeIn": true
//         },
//         {
//             "action": "talk",
//             "text": "1 Pizza, 2 Sandwiches, 3 Fruits",
//             "voiceName": "Amy",
//             "bargeIn": true
//         },
//         {
//           "action": "input",
//           "eventUrl": [`${server_url}/ncco_1`]
//         }
//       ],
//       options:{
//         "step1":{
//           ncco:[]
//         }
//       }
//     }
//   }
// }

function defaultHistory(){
  const choicesItemsLeaf = {
    "1":{
      count:0
    },
    "2":{
      count:0
    },
    "3":{
      count:0
    }
  }

  const choicesItemsLevel2 = {
    "1":{
      count:0,
      choice: {...choicesItemsLeaf}
    },
    "2":{
      count:0,
      choice: {...choicesItemsLeaf}
    },
    "3":{
      count:0,
      choice: {...choicesItemsLeaf}
    },
  }

  const history = {
    "1":{
      count:0,
      choice: {...choicesItemsLevel2}
    },
    "2":{
      count:0,
      choice: {...choicesItemsLevel2}
    },
    "3":{
      count:0,
      choice: {...choicesItemsLevel2}
    }
  }

  return history;

}

const scenarios = {
    text:"Welcome to our nexmo iterative food delivery menu, What's your favourite food?",
    options: [
      {
        option_text:"1 Pizza",
        text:"What do you like on top of your Pizza?",
        options: [
          {
            option_text:"1 Tomato And Bufala",
            text:"So we are gonna deliver a Pizza with Tomato and Bufala, good choice!"
          },
          {
            option_text:"2 Pinnaple",
            text:"So we are gonna deliver a Pizza with pineapple, are you really sure?"
          },
          {
            option_text:"3 for 4 Cheese",
            text:"So we are gonna deliver a Pizza with 4 Cheese, Be sure you have the time to digest it"
          }
        ],
      },
      {
        option_text:"2 Sandwiches",
        text:"What do you like to have in your Sandwich?",
        options: [
          {
            option_text:"Bacon ",
            text:"So we are gonna deliver a Classic Bacon Sandwich"
          },
          {
            option_text:"Mayo and Tuna",
            text:"So we are gonna deliver a Mayo and Tuna Sandwich"
          },
          {
            option_text:"Chicken and Avocado",
            text:"So we are gonna deliver a Chicken and Avocado, along with an Hipster badge"
          }
        ],
      }
    ]
}

function generateSingleNCCO(text, options, next_ncco_url){
  return [
    {
        "action": "talk",
        "text": `${text}`,
        "voiceName": "Amy",
        "bargeIn": false
    },
    {
        "action": "talk",
        "text": `${options.map(opt => opt.option_text).join(", ")}`,
        "voiceName": "Amy",
        "bargeIn": false
    },
    {
    "action": "input",
      "eventUrl": [next_ncco_url],
      "eventMethod": "GET"
    }
  ]
}

function generateLeafNCCO(text){
  return [
    {
        "action": "talk",
        "text": `${text}`,
        "voiceName": "Amy",
        "bargeIn": false
    }

  ]
}


function generateNccoMap(scenarios, config){
  const {server_url} = config
  const ncco_map ={}
  const step1_options = scenarios.options

  ncco_map["child"] = {
    ncco:generateSingleNCCO(scenarios.text, scenarios.options, `${server_url}/ncco`),
    children:[]
  }

  scenarios.options.forEach((opt, idx ) => {
    ncco_map['child'].children[idx] = {
      ncco: generateSingleNCCO(opt.text, opt.options, `${server_url}/ncco/0`),
      children: opt.options.map( ({text}) => generateLeafNCCO(text) )
    }
  })

  return ncco_map

}


function print(obj){
  console.log(JSON.stringify(obj, '  ', '  '))
}
module.exports = {
  generateNccoMap,
  scenarios
}
// print(defaultHistory())
print(generateNccoMap(scenarios, {server_url: "http://server_url.com"}));
