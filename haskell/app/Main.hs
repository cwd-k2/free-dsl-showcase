module Main (main) where

import Dsl.Continuation qualified as Continuation
import Dsl.Defunctionalization qualified as Defunctionalization
import Dsl.Free qualified as Free
import Dsl.Freer qualified as Freer

main :: IO ()
main = do
  putStrLn "Continuation and defunctionalization"
  putStrLn ("  direct: " <> show Continuation.directExample)
  putStrLn ("  CPS:    " <> show Continuation.cpsExample)
  putStrLn ("  frames: " <> show Defunctionalization.defunctionalizedExample)
  putStrLn ""
  putStrLn "The same Talk program, interpreted from two representations"
  putStrLn ("  Free:  " <> show (Free.runTalk ["Ada"] Free.greet))
  putStrLn ("  Freer: " <> show (Freer.runTalk ["Ada"] Freer.greet))
