module Dsl.Continuation
  ( Cont,
    add,
    square,
    addCPS,
    squareCPS,
    bindCont,
    directExample,
    cpsExample,
  )
where

-- | A computation made explicit as "what to do with the produced value".
type Cont r a = (a -> r) -> r

add :: Int -> Int -> Int
add x y = x + y

square :: Int -> Int
square x = x * x

addCPS :: Int -> Int -> Cont r Int
addCPS x y continuation = continuation (add x y)

squareCPS :: Int -> Cont r Int
squareCPS x continuation = continuation (square x)

-- | Chain two CPS computations by making the remainder of the first explicit.
bindCont :: Cont r a -> (a -> Cont r b) -> Cont r b
bindCont computation next continuation =
  computation (\value -> next value continuation)

-- | (3 + 4)^2 + 1, written in direct style.
directExample :: Int
directExample = square (add 3 4) + 1

-- | The same expression with both remaining steps passed as continuations.
cpsExample :: Int
cpsExample =
  (addCPS 3 4 `bindCont` squareCPS) (+ 1)
