module Dsl.Defunctionalization
  ( Frame (..),
    applyFrame,
    runFrames,
    defunctionalizedExample,
  )
where

-- | The finite set of continuation functions used by the arithmetic example.
data Frame
  = ThenSquare
  | ThenAdd Int
  deriving (Eq, Show)

applyFrame :: Frame -> Int -> Int
applyFrame ThenSquare value = value * value
applyFrame (ThenAdd amount) value = value + amount

-- | An explicit continuation stack replacing nested function values.
runFrames :: [Frame] -> Int -> Int
runFrames [] value = value
runFrames (frame : rest) value = runFrames rest (applyFrame frame value)

-- | The same (3 + 4)^2 + 1 calculation as the CPS example.
defunctionalizedExample :: Int
defunctionalizedExample = runFrames [ThenSquare, ThenAdd 1] (3 + 4)
