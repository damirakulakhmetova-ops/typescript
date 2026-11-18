let xyz: string[] = ["apple", "banana", "cherry"];
console.log(xyz);
xyz.push("orange"); // add to the end orange
console.log(xyz);
xyz.splice(2, 1, "kiwi", "peach"); //from the second place delete 1 word and put kiwi and peach
console.log(xyz);
console.log(xyz.length); //length of the array which is 3 
xyz.splice(0, xyz.length - 1); // delete all elements except the last one
console.log(xyz);
xyz.push("alice", "bob"); //add alice and bob
console.log(xyz);
console.log(xyz.shift()); //delete the first item in the array 'orange'
console.log(xyz);

const abc:number = 3.14;
console.log(abc); 
let def:string = (15).toString(); //a text 15
console.log(def);
let damira:boolean = abc < 2; // it's false
console.log(damira);

console.log(xyz.pop()); // from the array alice and bob delete alice (the first item)
console.log(xyz.includes("bob")); //find whether the array includes bob - false because there is only alice left
console.log(xyz.slice(0, 1)); //show me the 0th item
