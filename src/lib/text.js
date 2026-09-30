// plural(1, 'class', 'classes') -> "1 class"    plural(3, 'class', 'classes') -> "3 classes"
// If the plural is just "+s", leave the third argument out: plural(2, 'subject') -> "2 subjects"
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
