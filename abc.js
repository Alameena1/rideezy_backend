const tree = {
  name: "root",
  children: [ {name: "tgdfg",children: [{ name: "llsodf" }, { name: "trrrdfg", children: [{ name: "lrdf" }] },],},{ name: "xwqer", children: [{ name: "possm" }] }, ],};

//

/*
            Write a function that takes 2 parameters. First parameter is a tree data and the example tree data is above. Second parameter is a string.
            Expected result: If the second parameter is "trrrdfg", the the return value is:
            { name: 'trrrdfg', children: [{name: 'lrdf'}] }
            */

function abc(tree, target) {
  if (tree.name == target) {
    return tree;
  }
  if (!tree.children) return undefined;
  for (let i = 0; i < tree.children.length; i++) {
    const result = abc(tree.children[i], target);
    if (result) return result;
  }
}
console.log(abc(tree, "xwqer"));
