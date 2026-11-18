const xyz: string[] = ["apple", "banana", "chery"];
console.log(xyz);
xyz.push("orange");
console.log(xyz);
xyz.splice(2, 1, "kiwi", "peach");
console.log(xyz);
console.log(xyz.length);
xyz.splice(0, xyz.length - 1);
console.log(xyz);
xyz.push("alice", "bob");
console.log(xyz);
console.log(xyz.shift());
console.log(xyz);

let abc:number = 3.14;
console.log(abc);
let def:string = (15).toString();
console.log(def);
let xyz2:boolean = abc < 2;
console.log(xyz2);

console.log(xyz.pop());
console.log(xyz.includes("bob"));
console.log(xyz.slice(0, 1));
