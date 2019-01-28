/* This will have to be a JSON file.

   Alternatively, we could just have a pair of whitelists,
     one for online and one for offline,
     then the complier flag becomes a Boolean.
*/
export const whiteList: { [key: string]: string } = {
  aModule: '<path to file>',
  anotherModule: '<path to file>',
  aThirdModule: '<link to file>'
}
